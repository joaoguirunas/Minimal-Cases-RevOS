# Perfil Comercial — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao usuário `user_type = 'comercial'` uma visão restrita por RLS (carrinhos do pipeline Loja com 15d+, sem dono, ou os dele), o botão Assumir, cupom de até 20% criado na Yampi, atribuição humana com comissão no `pedido_pago`, BI filtrado por ele + relatório de comissões para o admin, e prévia da capa do produto para todos.

**Architecture:** A regra de visibilidade vive em funções SQL `SECURITY DEFINER` (`is_commercial`, `commercial_pool_lead`, `lead_visible_to_commercial`) usadas por políticas `comercial_*` de RLS; as políticas atuais ganham `AND NOT is_commercial()`. Posse = stage real "Em negociação" no pipeline Loja via RPC atômica `claim_lead`. Cupom sai do agente para `_shared/yampi-coupon.ts` e ganha uma edge function própria. O front só se adapta ao papel: colunas virtuais no kanban, bloco Comercial no lead, aba única no BI, card de comissões no admin. Toda lógica nova do front nasce em `src/lib/**` puro com teste vitest; toda lógica nova de function nasce em `_shared/**` puro com teste Deno (convenção do repo — não há React Testing Library).

**Tech Stack:** Vite + React 18 + TS + shadcn/Tailwind + TanStack Query v5 · Supabase Postgres (RLS, plpgsql) + Edge Functions Deno · vitest (`npm test`) · `deno test --allow-env supabase/functions/_shared/` · `deno check supabase/functions/<fn>/index.ts`.

**Spec:** `docs/superpowers/specs/2026-09-09-comercial-recuperacao-design.md` (autoridade em conflito com este plano).

## Global Constraints

- Base: branch `feat/comercial` criada de `feat/esteira-rodada-3` (commit `1fb53fc`), worktree `.claude/worktrees/comercial`. **Nunca** `git stash`; `git add <arquivos>` + `git commit` na mesma invocação de shell.
- Pipeline de produção resolvido **por nome**: `'Esteira Minimal — Loja'`. Stages por nome: `'Carrinho abandonado'`, `'Em recuperação'`, `'Engajou'`, `'Em negociação'` (novo), `'Pagamento pendente'`, `'Recuperado'`, `'Perdido'`.
- Pool do comercial = pipeline Loja ∧ stage ∈ {`Carrinho abandonado`,`Em recuperação`,`Engajou`} ∧ `leads.created_at <= now() - interval '15 days'` ∧ `user_id IS NULL` ∧ `status NOT IN ('lost','archived','won')`.
- Cupom: agente `{5,10,15}`; comercial `{5,10,15,20}`; código `NOME{pct}` (ASCII, maiúsculo, ≤20 chars), colisão `NOME{pct}X2..X9`; `quantity:1`, `once_per_customer:true`, `min_value:0`, validade 1–7 dias (comercial default 3, agente default 2). Um cupom ativo por lead.
- Atribuição humana: `cupom` (crm_coupons.created_by) > `janela` (lead.user_id ∧ paid_at ≤ claimed_at + 7d). Snapshot de `commission_pct` no pedido.
- Assumir **não** cancela toques. Primeiro WhatsApp humano de um comercial → cancela só `followup_queue.channel='whatsapp'` pendentes do lead + `clients_people.ai_enabled=false`.
- Funções SQL novas: `SECURITY DEFINER STABLE SET search_path = public, pg_temp`; `REVOKE EXECUTE FROM PUBLIC, anon; GRANT EXECUTE TO authenticated, service_role`.
- Toda política nova `TO authenticated`; nenhuma `TO public`. Nenhuma tabela nova sem RLS. Advisor de segurança deve continuar com 0 erros.
- Migrations aplicadas pelo controlador via Management API (`POST /v1/projects/maigkwlgzinykfvemexf/database/query`, token no keychain "Supabase CLI", `User-Agent` de browser). Implementadores **não** aplicam SQL em produção.
- Deploy de functions pelo controlador (`supabase functions deploy <nome> --project-ref maigkwlgzinykfvemexf`).
- Baselines conhecidos (não culpar mudanças novas): `tsc` ~331 erros pré-existentes; `ai-agent-execute` tem ~110 erros de `deno check` pré-existentes; `whatsapp-templates-manage` tem 4 TS2345 pré-existentes. Comparar contra a base antes de julgar.
- Linguagem: código/comentários em pt-BR onde o arquivo já é pt-BR; nomes de identificadores em inglês como o resto do repo (`claim_lead`, `recovered_by`).

---

## Mapa de arquivos

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `supabase/migrations/20260909100000_comercial_recuperacao.sql` | colunas, stage, funções, RPC, políticas, backfill `sku_id` | 1 |
| `supabase/tests/comercial_rls_dryrun.sql` | asserções de RLS/claim rodadas em `BEGIN…ROLLBACK` | 1 |
| `supabase/functions/_shared/yampi-coupon.ts` (+ `.test.ts`) | `buildCouponCode`, `createPersonalCoupon` | 2 |
| `supabase/functions/ai-agent-execute/index.ts` | case `yampi_criar_cupom` usa o shared | 2 |
| `supabase/functions/_shared/comercial-coupon-message.ts` (+ `.test.ts`) | texto do template/preview e preço com desconto | 3 |
| `supabase/functions/commercial-coupon-create/index.ts` | edge function do cupom do comercial | 3 |
| `supabase/functions/_shared/comercial-attribution.ts` (+ `.test.ts`) | `decideHumanAttribution`, `extractFirstSkuId` | 4 |
| `supabase/functions/yampi-process-event/index.ts` | grava `recovered_by`/comissão e `leads.sku_id` | 4 |
| `supabase/functions/_shared/comercial-contact.ts` (+ `.test.ts`) | `shouldHandoffToHuman` | 5 |
| `supabase/functions/whatsapp-outbound/index.ts` | hook do primeiro WhatsApp humano | 5 |
| `supabase/functions/yampi-connect/index.ts` | spec do template `minimal_esteira_comercial_cupom` | 6 |
| `supabase/functions/_shared/click-nudge.ts` (+ `.test.ts`) | `'Em negociação'` em `NUDGE_BLOCKED_STAGES` | 6 |
| `src/lib/comercial/kanban.ts` (+ `.test.ts`) | colunas virtuais, agrupamento, idade | 7 |
| `src/components/negocios/KanbanBoard.tsx`, `StageColumn.tsx` | `columns` com N stages; sem drag; botão Assumir; miniatura; chip do dono | 7 |
| `src/hooks/useComercial.ts` | `useCommercialScope`, `useClaimLead`, `useSkuImages`, `useLeadCoupon`, `useCreateCommercialCoupon` | 8 |
| `src/pages/Negocios.tsx` | modo comercial (toolbar enxuta, colunas virtuais) | 8 |
| `src/lib/comercial/coupon.ts` (+ `.test.ts`) | preço com desconto e validade (front) | 9 |
| `src/components/negocios/NegocioComercialCard.tsx` | Assumir / Gerar cupom / Abrir conversa | 9 |
| `src/components/negocios/NegocioEsteira.tsx` | prévia da capa 200px; bloco Comercial; esconde Pausar toques | 9 |
| `src/pages/Conversas.tsx` | `?draft=` pré-preenche a mensagem | 9 |
| `src/lib/bi/comissoes.ts` (+ `.test.ts`) | agregação mês × comercial, CSV | 10 |
| `src/hooks/useReconversaoBI.ts` | novos campos + `comerciais` | 10 |
| `src/components/dashboard/reconversao/CommissionsCard.tsx` | card do admin | 10 |
| `src/components/dashboard/BIProReconversaoTab.tsx` | `scope` | 10 |
| `src/pages/Dashboard.tsx`, `src/components/layout/DashLayout.tsx`, `src/App.tsx`, `src/components/auth/HomeRedirect.tsx` | BI só Reconversão p/ comercial; sidebar; rota inicial | 11 |
| `src/types/usuarios.ts`, `src/hooks/useUsersNew.ts`, `src/components/modals/EditarUsuarioModal.tsx`, `src/components/config/UsuariosConfig.tsx` | campo Comissão (%) | 12 |

Paralelismo: Tasks 2–6 (backend) são disjuntas entre si e de 7–12 (front). Task 7 antes da 8. Task 10 antes da 11. Task 1 e 13 são do controlador.

---

### Task 0 (controlador): worktree e baseline

**Files:** nenhum de código.

- [ ] **Step 1: Criar o worktree a partir da rodada 3**

```bash
cd /Volumes/nvme/minimal/Minimal-Cases-RevOS
git worktree add .claude/worktrees/comercial -b feat/comercial feat/esteira-rodada-3
cd .claude/worktrees/comercial && npm ci --no-audit --no-fund
```

- [ ] **Step 2: Baseline**

```bash
npm test 2>&1 | tail -3            # esperado: 68 passed
deno test --allow-env supabase/functions/_shared/ 2>&1 | tail -2
npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"   # anotar o número (≈331)
```

- [ ] **Step 3: Commitar spec + plano no branch**

```bash
git add docs/superpowers/specs/2026-09-09-comercial-recuperacao-design.md docs/superpowers/plans/2026-09-09-comercial-recuperacao.md
git commit -m "docs: spec e plano — perfil comercial (pool 15d+, cupom 20%, comissão, prévia da capa)"
```

---

### Task 1: Migration + dry-run de RLS

**Files:**
- Create: `supabase/migrations/20260909100000_comercial_recuperacao.sql`
- Create: `supabase/tests/comercial_rls_dryrun.sql`

**Interfaces:**
- Produces (SQL): `public.is_commercial() boolean`, `public.commercial_pool_lead(public.leads) boolean`, `public.lead_visible_to_commercial(public.leads) boolean`, `public.claim_lead(p_lead_id uuid) jsonb` → `{ok:true}` | `{ok:false, reason:'ja_assumido'|'fora_do_pool'|'nao_comercial'}`; colunas `leads.claimed_at timestamptz`, `leads.sku_id integer`, `settings_users.commission_pct numeric(5,2)`, `crm_coupons.created_by uuid`, `crm_coupons.lead_id uuid`, `crm_coupons.percent integer`, `crm_coupons.expires_at timestamptz`, `esteira_reconversions.recovered_by uuid`, `esteira_reconversions.recovery_basis text`, `esteira_reconversions.commission_pct numeric(5,2)`, `esteira_reconversions.commission_value numeric(12,2)`, `tracked_links.created_by uuid`; stage `'Em negociação'` (order_index 3) no pipeline Loja.

- [ ] **Step 1: Escrever a migration**

```sql
-- COMERCIAL — perfil de recuperação manual (spec 2026-09-09-comercial-recuperacao-design.md)
-- Pool compartilhado de carrinhos com 15d+ · posse = stage "Em negociação" · cupom com autor ·
-- atribuição humana com comissão · RLS: comercial só vê o pool e o que é dele.
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
    'public.current_user_type()', 'public.is_commercial()',
    'public.commercial_pool_lead(public.leads)', 'public.lead_visible_to_commercial(public.leads)',
    'public.person_visible_to_commercial(uuid)', 'public.claim_lead(uuid)'] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
END $$;

-- ── 5. RLS: comercial cai SÓ nas políticas comercial_* ──────────────────────
-- 5a. políticas atuais "qualquer usuário ativo" ganham AND NOT is_commercial()
DO $$
DECLARE r record; v_qual text; v_check text;
BEGIN
  FOR r IN
    SELECT tablename, policyname, cmd, qual, with_check FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename IN ('leads','clients_people','messages','followup_queue','tracked_links',
                         'tracked_link_clicks','esteira_reconversions','crm_coupons',
                         'leads_pipelines','leads_stages','settings_users')
       AND roles::text IN ('{authenticated}','{public}')
       AND policyname NOT LIKE 'comercial_%'
       AND policyname NOT ILIKE '%service_role%'
  LOOP
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
CREATE POLICY comercial_select ON public.leads FOR SELECT TO authenticated
  USING (public.is_commercial() AND public.lead_visible_to_commercial(leads));
CREATE POLICY comercial_update_own ON public.leads FOR UPDATE TO authenticated
  USING (public.is_commercial() AND user_id = public.get_current_settings_user_id())
  WITH CHECK (public.is_commercial() AND user_id = public.get_current_settings_user_id());

CREATE POLICY comercial_select ON public.clients_people FOR SELECT TO authenticated
  USING (public.is_commercial() AND public.person_visible_to_commercial(id));
CREATE POLICY comercial_update ON public.clients_people FOR UPDATE TO authenticated
  USING (public.is_commercial() AND public.person_visible_to_commercial(id))
  WITH CHECK (public.is_commercial() AND public.person_visible_to_commercial(id));

CREATE POLICY comercial_select ON public.messages FOR SELECT TO authenticated
  USING (public.is_commercial() AND public.person_visible_to_commercial(people_id));
CREATE POLICY comercial_insert ON public.messages FOR INSERT TO authenticated
  WITH CHECK (public.is_commercial() AND user_id = public.get_current_settings_user_id() AND public.person_visible_to_commercial(people_id));
CREATE POLICY comercial_update_own ON public.messages FOR UPDATE TO authenticated
  USING (public.is_commercial() AND user_id = public.get_current_settings_user_id())
  WITH CHECK (public.is_commercial() AND user_id = public.get_current_settings_user_id());

CREATE POLICY comercial_select ON public.followup_queue FOR SELECT TO authenticated
  USING (public.is_commercial() AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = followup_queue.lead_id AND public.lead_visible_to_commercial(l)));

CREATE POLICY comercial_select ON public.tracked_links FOR SELECT TO authenticated
  USING (public.is_commercial() AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = tracked_links.lead_id AND public.lead_visible_to_commercial(l)));

DO $$ BEGIN
  IF to_regclass('public.tracked_link_clicks') IS NOT NULL THEN
    EXECUTE 'CREATE POLICY comercial_select ON public.tracked_link_clicks FOR SELECT TO authenticated
      USING (public.is_commercial() AND EXISTS (SELECT 1 FROM public.tracked_links tl JOIN public.leads l ON l.id = tl.lead_id
             WHERE tl.id = tracked_link_clicks.link_id AND public.lead_visible_to_commercial(l)))';
  END IF;
END $$;

CREATE POLICY comercial_select ON public.esteira_reconversions FOR SELECT TO authenticated
  USING (public.is_commercial() AND recovered_by = public.get_current_settings_user_id());

CREATE POLICY comercial_select ON public.crm_coupons FOR SELECT TO authenticated
  USING (public.is_commercial() AND created_by = public.get_current_settings_user_id());
CREATE POLICY comercial_insert ON public.crm_coupons FOR INSERT TO authenticated
  WITH CHECK (public.is_commercial() AND created_by = public.get_current_settings_user_id());

CREATE POLICY comercial_select ON public.leads_pipelines FOR SELECT TO authenticated
  USING (public.is_commercial() AND name = 'Esteira Minimal — Loja');
CREATE POLICY comercial_select ON public.leads_stages FOR SELECT TO authenticated
  USING (public.is_commercial() AND EXISTS (SELECT 1 FROM public.leads_pipelines p WHERE p.id = leads_stages.leads_pipelines_id AND p.name = 'Esteira Minimal — Loja'));

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
     AND e.raw_payload->'resource'->'items'->'data'->0->'sku'->'data'->>'id' ~ '^[0-9]+$'
   ORDER BY e.people_id, e.created_at DESC
)
UPDATE public.leads l SET sku_id = last_ev.sku_id
  FROM last_ev
 WHERE l.people_id = last_ev.people_id AND l.sku_id IS NULL;

COMMIT;
```

- [ ] **Step 2: Escrever o dry-run de asserções** (`supabase/tests/comercial_rls_dryrun.sql`) — roda inteiro dentro de `BEGIN … ROLLBACK`, logo **nada persiste**. Simula o JWT via `set_config('request.jwt.claims', …)` e `SET LOCAL ROLE authenticated`.

```sql
-- Dry-run: aplicar a migration + estas asserções em UMA transação e dar ROLLBACK no final.
-- Qualquer RAISE EXCEPTION aborta → a migration não sobe. Rodar pelo controlador (Management API).
DO $$
DECLARE
  v_pipe uuid; v_stage_ca uuid; v_stage_rec uuid; v_stage_neg uuid;
  v_admin_auth uuid := gen_random_uuid(); v_c1_auth uuid := gen_random_uuid(); v_c2_auth uuid := gen_random_uuid();
  v_c1 uuid; v_c2 uuid; v_p1 uuid; v_p2 uuid; v_p3 uuid;
  v_pool uuid; v_recente uuid; v_outro_rec uuid; v_validacao uuid;
  v_n integer; v_res jsonb;
BEGIN
  SELECT id INTO v_pipe FROM public.leads_pipelines WHERE name = 'Esteira Minimal — Loja';
  SELECT id INTO v_stage_ca  FROM public.leads_stages WHERE leads_pipelines_id = v_pipe AND name = 'Carrinho abandonado';
  SELECT id INTO v_stage_rec FROM public.leads_stages WHERE leads_pipelines_id = v_pipe AND name = 'Recuperado';
  SELECT id INTO v_stage_neg FROM public.leads_stages WHERE leads_pipelines_id = v_pipe AND name = 'Em negociação';
  IF v_stage_neg IS NULL THEN RAISE EXCEPTION 'stage Em negociação não criado'; END IF;
  IF (SELECT order_index FROM public.leads_stages WHERE id = v_stage_neg) <> 3 THEN RAISE EXCEPTION 'order_index de Em negociação deveria ser 3'; END IF;
  IF (SELECT order_index FROM public.leads_stages WHERE id = v_stage_rec) <> 6 THEN RAISE EXCEPTION 'Recuperado deveria ter sido reindexado para 6'; END IF;

  INSERT INTO auth.users (id, email) VALUES (v_c1_auth, 'dry-c1@test.local'), (v_c2_auth, 'dry-c2@test.local');
  INSERT INTO public.settings_users (auth_user_id, name, email, user_type, active)
    VALUES (v_c1_auth, 'C1', 'dry-c1@test.local', 'comercial', true) RETURNING id INTO v_c1;
  INSERT INTO public.settings_users (auth_user_id, name, email, user_type, active)
    VALUES (v_c2_auth, 'C2', 'dry-c2@test.local', 'comercial', true) RETURNING id INTO v_c2;

  INSERT INTO public.clients_people (name, email) VALUES ('Pool', 'pool@t.local') RETURNING id INTO v_p1;
  INSERT INTO public.clients_people (name, email) VALUES ('Recente', 'rec@t.local') RETURNING id INTO v_p2;
  INSERT INTO public.clients_people (name, email) VALUES ('Outro', 'outro@t.local') RETURNING id INTO v_p3;

  INSERT INTO public.leads (title, people_id, leads_pipelines_id, leads_stages_id, status, created_at)
    VALUES ('pool', v_p1, v_pipe, v_stage_ca, 'in_progress', now() - interval '16 days') RETURNING id INTO v_pool;
  INSERT INTO public.leads (title, people_id, leads_pipelines_id, leads_stages_id, status, created_at)
    VALUES ('recente', v_p2, v_pipe, v_stage_ca, 'in_progress', now() - interval '14 days') RETURNING id INTO v_recente;
  INSERT INTO public.leads (title, people_id, leads_pipelines_id, leads_stages_id, status, created_at, user_id)
    VALUES ('rec de outro', v_p3, v_pipe, v_stage_rec, 'won', now() - interval '30 days', v_c2) RETURNING id INTO v_outro_rec;
  INSERT INTO public.leads (title, people_id, leads_pipelines_id, leads_stages_id, status, created_at)
    SELECT 'validacao', v_p1, p.id, s.id, 'in_progress', now() - interval '30 days'
      FROM public.leads_pipelines p JOIN public.leads_stages s ON s.leads_pipelines_id = p.id AND s.name = 'Carrinho abandonado'
     WHERE p.name = 'Esteira Validação' LIMIT 1 RETURNING id INTO v_validacao;

  -- ── como C1 ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_c1_auth, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
  IF NOT public.is_commercial() THEN RAISE EXCEPTION 'C1 deveria ser comercial'; END IF;

  SELECT count(*) INTO v_n FROM public.leads WHERE id = v_pool;      IF v_n <> 1 THEN RAISE EXCEPTION 'C1 deveria ver o lead do pool'; END IF;
  SELECT count(*) INTO v_n FROM public.leads WHERE id = v_recente;   IF v_n <> 0 THEN RAISE EXCEPTION 'C1 NÃO deveria ver lead com 14d'; END IF;
  SELECT count(*) INTO v_n FROM public.leads WHERE id = v_outro_rec; IF v_n <> 0 THEN RAISE EXCEPTION 'C1 NÃO deveria ver Recuperado de C2'; END IF;
  SELECT count(*) INTO v_n FROM public.leads WHERE id = v_validacao; IF v_n <> 0 THEN RAISE EXCEPTION 'C1 NÃO deveria ver pipeline Validação'; END IF;
  SELECT count(*) INTO v_n FROM public.clients_people WHERE id = v_p2; IF v_n <> 0 THEN RAISE EXCEPTION 'C1 NÃO deveria ver pessoa de lead invisível'; END IF;
  SELECT count(*) INTO v_n FROM public.omni_channel_configs;        IF v_n <> 0 THEN RAISE EXCEPTION 'C1 NÃO deveria ver omni_channel_configs'; END IF;
  SELECT count(*) INTO v_n FROM public.leads_pipelines;             IF v_n <> 1 THEN RAISE EXCEPTION 'C1 deveria ver exatamente 1 pipeline (Loja), viu %', v_n; END IF;
  SELECT count(*) INTO v_n FROM public.settings_users;              IF v_n <> 1 THEN RAISE EXCEPTION 'C1 deveria ver só a própria linha'; END IF;

  v_res := public.claim_lead(v_pool);
  IF (v_res->>'ok')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'claim de C1 deveria dar ok: %', v_res; END IF;
  SELECT count(*) INTO v_n FROM public.leads WHERE id = v_pool AND user_id = v_c1 AND leads_stages_id = v_stage_neg AND claimed_at IS NOT NULL;
  IF v_n <> 1 THEN RAISE EXCEPTION 'lead assumido deveria estar em Em negociação com dono C1'; END IF;
  v_res := public.claim_lead(v_recente);
  IF v_res->>'reason' <> 'fora_do_pool' THEN RAISE EXCEPTION 'claim de lead recente deveria ser fora_do_pool: %', v_res; END IF;

  -- ── como C2 ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_c2_auth, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO v_n FROM public.leads WHERE id = v_pool;      IF v_n <> 0 THEN RAISE EXCEPTION 'C2 NÃO deveria ver lead assumido por C1'; END IF;
  v_res := public.claim_lead(v_pool);
  IF v_res->>'reason' <> 'ja_assumido' THEN RAISE EXCEPTION 'C2 deveria receber ja_assumido: %', v_res; END IF;
  SELECT count(*) INTO v_n FROM public.leads WHERE id = v_outro_rec; IF v_n <> 1 THEN RAISE EXCEPTION 'C2 deveria ver o próprio Recuperado'; END IF;

  PERFORM set_config('role', 'postgres', true);
  PERFORM set_config('request.jwt.claims', '', true);
  RAISE NOTICE 'DRY-RUN OK';
END $$;
```

- [ ] **Step 3 (controlador): Dry-run contra produção com ROLLBACK**

Montar um único SQL = conteúdo da migration **sem** o `COMMIT;` final + conteúdo do dry-run + `ROLLBACK;`, e enviar pela Management API. Esperado: resposta sem `message` de erro (o `NOTICE 'DRY-RUN OK'` não volta pela API, mas qualquer `RAISE EXCEPTION` volta como erro). Se falhar, corrigir a migration e repetir. Nada é persistido.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260909100000_comercial_recuperacao.sql supabase/tests/comercial_rls_dryrun.sql
git commit -m "feat(comercial): migration — pool 15d+, stage Em negociação, claim_lead, cupom com autor, comissão, RLS do comercial"
```

---

### Task 2: `_shared/yampi-coupon.ts` e refatoração do agente

**Files:**
- Create: `supabase/functions/_shared/yampi-coupon.ts`, `supabase/functions/_shared/yampi-coupon.test.ts`
- Modify: `supabase/functions/ai-agent-execute/index.ts` (case `'yampi_criar_cupom'`, ~l.2668–2730)

**Interfaces:**
- Produces: `buildCouponCode(firstName: string, percent: number): string`; `COUPON_PERCENTS_AGENT = [5,10,15]`; `COUPON_PERCENTS_COMMERCIAL = [5,10,15,20]`; `createPersonalCoupon(supabase, client, opts): Promise<CouponCreated>` com `opts = { firstName, percent, validityDays, freeShipping?, peopleId, leadId, source: 'agente'|'comercial', createdBy }` e `CouponCreated = { code, percent, expiresAt: string (ISO), reused: boolean }`.

- [ ] **Step 1: Teste da função pura**

```ts
// supabase/functions/_shared/yampi-coupon.test.ts
// Run: deno test --allow-env supabase/functions/_shared/yampi-coupon.test.ts
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildCouponCode, pickCouponCode, COUPON_PERCENTS_AGENT, COUPON_PERCENTS_COMMERCIAL } from './yampi-coupon.ts';

Deno.test('buildCouponCode: primeiro nome ASCII maiúsculo + percentual, ≤20 chars', () => {
  assertEquals(buildCouponCode('Gabriella Souza', 10), 'GABRIELLA10');
  assertEquals(buildCouponCode('joão-pedro', 20), 'JOOPEDRO20');
  assertEquals(buildCouponCode('', 5), 'CLIENTE5');
  assertEquals(buildCouponCode('Maximiliano Alexandre', 15).length <= 20, true);
});

Deno.test('pickCouponCode: reaproveita ativo, sufixa quando o base está usado/expirado', async () => {
  const existsNone = async (_c: string) => null;
  assertEquals(await pickCouponCode('Ana', 10, existsNone), { code: 'ANA10', reused: false });
  const ativo = async (c: string) => c === 'ANA10' ? { active: true, expired: false, value: 10 } : null;
  assertEquals(await pickCouponCode('Ana', 10, ativo), { code: 'ANA10', reused: true });
  const usado = async (c: string) => (c === 'ANA10' || c === 'ANA10X2') ? { active: false, expired: true, value: 10 } : null;
  assertEquals(await pickCouponCode('Ana', 10, usado), { code: 'ANA10X3', reused: false });
});

Deno.test('listas de percentuais', () => {
  assertEquals([...COUPON_PERCENTS_AGENT], [5, 10, 15]);
  assertEquals([...COUPON_PERCENTS_COMMERCIAL], [5, 10, 15, 20]);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `deno test --allow-env supabase/functions/_shared/yampi-coupon.test.ts` → FAIL (módulo não existe).

- [ ] **Step 3: Implementar o shared**

```ts
// supabase/functions/_shared/yampi-coupon.ts
/**
 * _shared/yampi-coupon.ts — cupom pessoal de uso único na Yampi (agente e comercial).
 * Extraído do case `yampi_criar_cupom` do ai-agent-execute; comportamento do agente preservado.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { YampiApiClient, YampiPromocode } from './yampi-client.ts';

export const COUPON_PERCENTS_AGENT = [5, 10, 15] as const;
export const COUPON_PERCENTS_COMMERCIAL = [5, 10, 15, 20] as const;

export function buildCouponCode(firstName: string, percent: number): string {
  const first = (firstName ?? '').trim().split(/\s+/)[0] ?? '';
  const ascii = first.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || 'CLIENTE';
  return `${ascii}${percent}`.slice(0, 20);
}

type Existing = Pick<YampiPromocode, 'active' | 'expired' | 'value'> | null;

/** Decide o código: reaproveita o base se ativo, senão tenta X2..X9. `find` consulta a Yampi. */
export async function pickCouponCode(
  firstName: string, percent: number, find: (code: string) => Promise<Existing>,
): Promise<{ code: string; reused: boolean }> {
  const base = buildCouponCode(firstName, percent);
  const existing = await find(base);
  if (!existing) return { code: base, reused: false };
  if (existing.active && !existing.expired) return { code: base, reused: true };
  for (let n = 2; n <= 9; n++) {
    const candidate = `${base}X${n}`.slice(0, 20);
    if (!(await find(candidate))) return { code: candidate, reused: false };
  }
  return { code: `${base}X9`.slice(0, 20), reused: false };
}

export interface CreateCouponOpts {
  firstName: string; percent: number; validityDays: number; freeShipping?: boolean;
  peopleId: string | null; leadId: string | null;
  source: 'agente' | 'comercial'; createdBy: string | null;
}
export interface CouponCreated { code: string; percent: number; expiresAt: string; reused: boolean }

const fmtYampi = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');

export async function createPersonalCoupon(
  supabase: SupabaseClient, client: YampiApiClient, opts: CreateCouponOpts,
): Promise<CouponCreated> {
  const dias = Math.min(Math.max(Math.floor(opts.validityDays) || 2, 1), 7);
  const { code, reused } = await pickCouponCode(opts.firstName, opts.percent, (c) => client.findPromocode(c));
  const now = new Date();
  const end = new Date(now.getTime() + dias * 24 * 3600_000);
  if (!reused) {
    await client.createPromocode({
      code, discount_type: 'p', value: opts.percent, quantity: 1,
      min_value: 0, // obrigatório na Yampi (422 sem ele)
      once_per_customer: true, accumulate: false, free_shipment: opts.freeShipping === true,
      abandoned_cart: false, active: true, start_at: fmtYampi(now), end_at: fmtYampi(end),
    });
  }
  await supabase.from('crm_coupons').upsert(
    { code, source: opts.source, people_id: opts.peopleId, lead_id: opts.leadId, percent: opts.percent,
      created_by: opts.createdBy, expires_at: reused ? undefined : end.toISOString() },
    { onConflict: 'code', ignoreDuplicates: true },
  );
  return { code, percent: opts.percent, expiresAt: end.toISOString(), reused };
}
```

Confirmar em `yampi-client.ts` que `YampiPromocode` e `YampiApiClient` são exportados (`grep -n "export interface YampiPromocode\|export class YampiApiClient"`); se `YampiApiClient` não for exportado, exportar a classe (só `export` na declaração existente).

- [ ] **Step 4: Rodar e ver passar**

Run: `deno test --allow-env supabase/functions/_shared/yampi-coupon.test.ts` → 3 passed.

- [ ] **Step 5: Refatorar o agente para usar o shared** — substituir o corpo do `case 'yampi_criar_cupom'` (mantendo as mensagens de retorno):

```ts
      case 'yampi_criar_cupom': {
        const percentual = Number(args.percentual ?? 0);
        if (!(COUPON_PERCENTS_AGENT as readonly number[]).includes(percentual)) return 'Error: percentual deve ser 5, 10 ou 15.';
        const dias = Math.min(Math.max(Number(args.dias_validade ?? 2) || 2, 1), 7);
        const { createYampiClientForConnection } = await import('../_shared/yampi-client.ts');
        const bound = await createYampiClientForConnection(supabase as never);
        if (!bound) return 'Integração Yampi não está conectada.';
        try {
          const r = await createPersonalCoupon(supabase as never, bound.client, {
            firstName: ctx.nome ?? 'CLIENTE', percent: percentual, validityDays: dias,
            freeShipping: args.frete_gratis === true, peopleId: ctx.pessoa_id ?? null, leadId,
            source: 'agente', createdBy: null,
          });
          if (r.reused) return JSON.stringify({ cupom: r.code, situacao: 'ja_existia_e_esta_ativo', percentual: r.percent });
          return JSON.stringify({
            cupom: r.code, percentual: r.percent,
            valido_ate: r.expiresAt.slice(0, 19).replace('T', ' '),
            uso: 'único, apenas para este cliente',
            instrucao: 'Informe o código ao cliente e reforce a validade curta. Você pode anexá-lo a um checkout novo com yampi_enviar_link_pagamento passando cupom.',
          });
        } catch (e) {
          return `Erro ao criar cupom na Yampi: ${(e as Error).message}`;
        }
      }
```

Import no topo do arquivo: `import { COUPON_PERCENTS_AGENT, createPersonalCoupon } from '../_shared/yampi-coupon.ts';`. `leadId` é a variável já disponível no escopo do executor de tools (a mesma usada em `yampi_enviar_link_pagamento`); se o nome no escopo for outro, usar o mesmo que aquele case usa.

- [ ] **Step 6: Checar tipos sem regredir**

Run: `deno check supabase/functions/ai-agent-execute/index.ts 2>&1 | grep -c "error"` — comparar com o mesmo comando na base (`git stash` é proibido: rodar `git show feat/esteira-rodada-3:supabase/functions/ai-agent-execute/index.ts > /tmp/base-agent.ts` e `deno check` nele **não funciona** por imports relativos; em vez disso, conferir que nenhum erro novo menciona `yampi-coupon`, `createPersonalCoupon` ou as linhas do case editado).

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/_shared/yampi-coupon.ts supabase/functions/_shared/yampi-coupon.test.ts supabase/functions/ai-agent-execute/index.ts
git commit -m "refactor(cupom): createPersonalCoupon em _shared/yampi-coupon; agente usa o shared (5/10/15 preservado)"
```

---

### Task 3: Edge function `commercial-coupon-create`

**Files:**
- Create: `supabase/functions/_shared/comercial-coupon-message.ts`, `supabase/functions/_shared/comercial-coupon-message.test.ts`
- Create: `supabase/functions/commercial-coupon-create/index.ts`

**Interfaces:**
- Consumes: `createPersonalCoupon`, `COUPON_PERCENTS_COMMERCIAL` (Task 2); RPC `claim_lead` (Task 1); `resolveCartForPerson`, `createTrackedLinkDetailed`, `formatBRL` de `_shared/tracked-links.ts`.
- Produces (HTTP): `POST { lead_id, percent, validity_days? }` → `200 { ok:true, code, percent, expires_at, price, price_with_coupon, cart_url, tracked_url, message_preview, reused }` | `{ ok:false, error, code: 'LEAD_INVISIVEL'|'JA_ASSUMIDO'|'PERCENT_INVALIDO'|'SEM_YAMPI'|'YAMPI_ERRO' }` (HTTP 200 sempre, exceto 401/403 — padrão `email-template-test-send`).
- Produces: `buildComercialCupomMessage(v): string` e `priceWithCoupon(total, percent): number | null`.

- [ ] **Step 1: Teste do builder**

```ts
// supabase/functions/_shared/comercial-coupon-message.test.ts
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildComercialCupomMessage, priceWithCoupon, COMERCIAL_CUPOM_TEMPLATE_NAME } from './comercial-coupon-message.ts';

Deno.test('priceWithCoupon: arredonda em centavos; null sem total', () => {
  assertEquals(priceWithCoupon(159.9, 20), 127.92);
  assertEquals(priceWithCoupon(159.9, 15), 135.92);
  assertEquals(priceWithCoupon(null, 20), null);
});

Deno.test('buildComercialCupomMessage: mesmo texto do template Meta, com os 6 parâmetros', () => {
  const msg = buildComercialCupomMessage({ nome: 'Gabriella', remetente: 'Hyago', produto: 'Case Minimal Preta', percentual: 20, cupom: 'GABRIELLA20', validade: '12/09' });
  assertEquals(msg.includes('Oi Gabriella, aqui é Hyago da Minimal Cases'), true);
  assertEquals(msg.includes('cupom de 20% só pra você: GABRIELLA20'), true);
  assertEquals(msg.includes('vale até 12/09'), true);
  assertEquals(COMERCIAL_CUPOM_TEMPLATE_NAME, 'minimal_esteira_comercial_cupom');
});
```

- [ ] **Step 2: Rodar e ver falhar** — `deno test --allow-env supabase/functions/_shared/comercial-coupon-message.test.ts` → FAIL.

- [ ] **Step 3: Implementar**

```ts
// supabase/functions/_shared/comercial-coupon-message.ts
export const COMERCIAL_CUPOM_TEMPLATE_NAME = 'minimal_esteira_comercial_cupom';

export function priceWithCoupon(total: number | null, percent: number): number | null {
  if (total === null || !Number.isFinite(total)) return null;
  return Math.round(total * (1 - percent / 100) * 100) / 100;
}

export interface CupomMessageVars { nome: string; remetente: string; produto: string; percentual: number; cupom: string; validade: string }

/** Texto idêntico ao BODY do template Meta (yampi-connect, spec §5.1) — {{1..6}} nesta ordem. */
export function buildComercialCupomMessage(v: CupomMessageVars): string {
  return `Oi ${v.nome}, aqui é ${v.remetente} da Minimal Cases 👋\n` +
    `Vi que sua ${v.produto} ficou separada no carrinho.\n` +
    `Separei um cupom de ${v.percentual}% só pra você: ${v.cupom} — vale até ${v.validade}.\n` +
    `Quer que eu te ajude a finalizar?`;
}
```

- [ ] **Step 4: Rodar e ver passar** — 2 passed.

- [ ] **Step 5: Edge function**

```ts
// supabase/functions/commercial-coupon-create/index.ts
/**
 * commercial-coupon-create — cupom pessoal (5/10/15/20%) gerado pelo comercial.
 * Auth: JWT do usuário → settings_users ativo com user_type='comercial' (ou admin/gestor).
 * Lê o lead com o client DO USUÁRIO (RLS decide se ele pode ver) e, se o lead não tem dono,
 * assume via claim_lead. Cria na Yampi com service_role. 1 cupom ativo por lead (reaproveita).
 * Sempre HTTP 200 com { ok } exceto 401/403 — o front lê a mensagem.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { COUPON_PERCENTS_COMMERCIAL, createPersonalCoupon } from '../_shared/yampi-coupon.ts';
import { createYampiClientForConnection } from '../_shared/yampi-client.ts';
import { createTrackedLinkDetailed, formatBRL, resolveCartForPerson } from '../_shared/tracked-links.ts';
import { buildComercialCupomMessage, priceWithCoupon } from '../_shared/comercial-coupon-message.ts';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const Req = z.object({
  lead_id: z.string().uuid(),
  percent: z.number().int().refine((p) => (COUPON_PERCENTS_COMMERCIAL as readonly number[]).includes(p), 'percent deve ser 5, 10, 15 ou 20'),
  validity_days: z.number().int().min(1).max(7).optional(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  try {
    const auth = req.headers.get('Authorization') ?? '';
    if (!auth.startsWith('Bearer ')) return json({ ok: false, error: 'Unauthorized' }, 401);
    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: auth } } });
    const { data: u, error: uErr } = await userClient.auth.getUser(auth.replace('Bearer ', ''));
    if (uErr || !u?.user) return json({ ok: false, error: 'Unauthorized' }, 401);
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    const { data: me } = await admin.from('settings_users').select('id, name, user_type, super_admin, active, deleted_at')
      .eq('auth_user_id', u.user.id).maybeSingle();
    const meRow = me as { id: string; name: string | null; user_type: string | null; super_admin: boolean | null; active: boolean | null; deleted_at: string | null } | null;
    if (!meRow || !meRow.active || meRow.deleted_at) return json({ ok: false, error: 'Usuário sem perfil ativo' }, 403);
    const isAdmin = meRow.super_admin === true || meRow.user_type === 'admin' || meRow.user_type === 'manager';
    if (!isAdmin && meRow.user_type !== 'comercial') return json({ ok: false, error: 'Apenas comercial ou gestor geram cupom' }, 403);

    let input: z.infer<typeof Req>;
    try { input = Req.parse(await req.json()); }
    catch (e) { return json({ ok: false, code: 'PERCENT_INVALIDO', error: e instanceof z.ZodError ? e.errors[0].message : 'Input inválido' }); }

    // Lead pela RLS do usuário: invisível = não existe pra ele.
    const { data: leadRaw } = await userClient.from('leads').select('id, user_id, people_id, title').eq('id', input.lead_id).maybeSingle();
    let lead = leadRaw as { id: string; user_id: string | null; people_id: string | null; title: string | null } | null;
    if (!lead) return json({ ok: false, code: 'LEAD_INVISIVEL', error: 'Carrinho não está disponível pra você.' });

    if (!lead.user_id && !isAdmin) {
      const { data: claim } = await userClient.rpc('claim_lead', { p_lead_id: lead.id });
      const c = claim as { ok: boolean; reason?: string } | null;
      if (!c?.ok) return json({ ok: false, code: 'JA_ASSUMIDO', error: c?.reason === 'ja_assumido' ? 'Outro comercial acabou de assumir este carrinho.' : 'Carrinho fora do pool.' });
      lead = { ...lead, user_id: meRow.id };
    }
    if (!isAdmin && lead.user_id !== meRow.id) return json({ ok: false, code: 'LEAD_INVISIVEL', error: 'Este carrinho é de outro comercial.' }, 403);

    // 1 cupom ativo por lead → devolve o existente.
    const { data: existing } = await admin.from('crm_coupons').select('code, percent, expires_at')
      .eq('lead_id', lead.id).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(1).maybeSingle();
    const ex = existing as { code: string; percent: number | null; expires_at: string } | null;

    const bound = await createYampiClientForConnection(admin as never);
    if (!bound) return json({ ok: false, code: 'SEM_YAMPI', error: 'Integração Yampi não conectada.' });

    const cart = lead.people_id ? await resolveCartForPerson(admin as never, lead.people_id) : null;
    const { data: person } = await admin.from('clients_people').select('name').eq('id', lead.people_id ?? '').maybeSingle();
    const nome = ((person as { name: string | null } | null)?.name ?? 'cliente').split(/\s+/)[0];

    let code = ex?.code ?? null, percent = ex?.percent ?? input.percent, expiresAt = ex?.expires_at ?? null, reused = !!ex;
    if (!ex) {
      try {
        const r = await createPersonalCoupon(admin as never, bound.client, {
          firstName: nome, percent: input.percent, validityDays: input.validity_days ?? 3,
          peopleId: lead.people_id, leadId: lead.id, source: 'comercial', createdBy: meRow.id,
        });
        code = r.code; percent = r.percent; expiresAt = r.expiresAt; reused = r.reused;
      } catch (e) { return json({ ok: false, code: 'YAMPI_ERRO', error: `Yampi: ${(e as Error).message}` }); }
    }

    const tracked = cart?.url ? await createTrackedLinkDetailed(admin as never, {
      destination: cart.url, peopleId: lead.people_id, leadId: lead.id, channel: 'whatsapp',
      source: 'manual', label: 'cupom_comercial', templateName: 'minimal_esteira_comercial_cupom',
    }) : null;
    if (tracked) await admin.from('tracked_links').update({ created_by: meRow.id }).eq('id', tracked.id);

    const validade = expiresAt ? new Date(expiresAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' }) : '';
    const produto = cart?.produto ?? (lead.title ?? '').split(' — ')[0] ?? 'sua case';
    const preview = buildComercialCupomMessage({ nome, remetente: (meRow.name ?? 'Minimal Cases').split(/\s+/)[0], produto, percentual: percent, cupom: code!, validade });

    return json({
      ok: true, code, percent, expires_at: expiresAt, reused,
      price: cart?.total ?? null, price_with_coupon: priceWithCoupon(cart?.total ?? null, percent),
      price_label: formatBRL(cart?.total ?? null), price_with_coupon_label: formatBRL(priceWithCoupon(cart?.total ?? null, percent)),
      cart_url: cart?.url ?? null, tracked_url: tracked?.url ?? cart?.url ?? null, message_preview: preview,
    });
  } catch (e) {
    console.error('commercial-coupon-create', e);
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
```

Conferir que `resolveCartForPerson` devolve `{ url, produto, total }` (sim — `PersonCart`, `_shared/tracked-links.ts` l.179+) e que `TrackedLinkSource` aceita `'manual'` (aceita).

- [ ] **Step 6: Checar** — `deno check supabase/functions/commercial-coupon-create/index.ts` → sem erros.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/_shared/comercial-coupon-message.ts supabase/functions/_shared/comercial-coupon-message.test.ts supabase/functions/commercial-coupon-create/index.ts
git commit -m "feat(comercial): edge function commercial-coupon-create — cupom 5/10/15/20 na Yampi, assume o lead, preview da mensagem"
```

---

### Task 4: Atribuição humana e `leads.sku_id` no `yampi-process-event`

**Files:**
- Create: `supabase/functions/_shared/comercial-attribution.ts`, `supabase/functions/_shared/comercial-attribution.test.ts`
- Modify: `supabase/functions/yampi-process-event/index.ts` (`moveLead` ~l.121–165; bloco `pedido_pago` ~l.400–445)

**Interfaces:**
- Produces: `decideHumanAttribution(input): { recoveredBy: string|null; basis: 'cupom'|'janela'|null }` com `input = { couponCreatedBy: string|null; leadUserId: string|null; leadClaimedAt: string|null; paidAt: Date; windowDays?: number }`; `commissionValue(total, pct): number|null`; `extractFirstSkuId(rawPayload): number|null`.

- [ ] **Step 1: Testes**

```ts
// supabase/functions/_shared/comercial-attribution.test.ts
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { decideHumanAttribution, commissionValue, extractFirstSkuId } from './comercial-attribution.ts';

const paid = new Date('2026-09-20T12:00:00Z');
Deno.test('cupom do comercial vence tudo', () => {
  assertEquals(decideHumanAttribution({ couponCreatedBy: 'A', leadUserId: 'B', leadClaimedAt: '2026-09-19T00:00:00Z', paidAt: paid }), { recoveredBy: 'A', basis: 'cupom' });
});
Deno.test('sem cupom: dono dentro de 7d → janela; fora → nada', () => {
  assertEquals(decideHumanAttribution({ couponCreatedBy: null, leadUserId: 'B', leadClaimedAt: '2026-09-14T12:00:01Z', paidAt: paid }), { recoveredBy: 'B', basis: 'janela' });
  assertEquals(decideHumanAttribution({ couponCreatedBy: null, leadUserId: 'B', leadClaimedAt: '2026-09-12T11:59:59Z', paidAt: paid }), { recoveredBy: null, basis: null });
  assertEquals(decideHumanAttribution({ couponCreatedBy: null, leadUserId: null, leadClaimedAt: null, paidAt: paid }), { recoveredBy: null, basis: null });
  assertEquals(decideHumanAttribution({ couponCreatedBy: null, leadUserId: 'B', leadClaimedAt: null, paidAt: paid }), { recoveredBy: null, basis: null });
});
Deno.test('commissionValue', () => {
  assertEquals(commissionValue(159.9, 3), 4.8);
  assertEquals(commissionValue(159.9, null), 0);
  assertEquals(commissionValue(null, 3), null);
});
Deno.test('extractFirstSkuId lê resource.items.data[0].sku.data.id', () => {
  assertEquals(extractFirstSkuId({ resource: { items: { data: [{ sku: { data: { id: 296095975 } } }] } } }), 296095975);
  assertEquals(extractFirstSkuId({ resource: { items: [] } }), null);
  assertEquals(extractFirstSkuId(null), null);
});
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar**

```ts
// supabase/functions/_shared/comercial-attribution.ts
/** Atribuição HUMANA do pedido pago (spec §3.3): cupom do comercial > carrinho dele pago em ≤7d de claimed_at. */
export interface HumanAttributionInput {
  couponCreatedBy: string | null; leadUserId: string | null; leadClaimedAt: string | null; paidAt: Date; windowDays?: number;
}
export function decideHumanAttribution(i: HumanAttributionInput): { recoveredBy: string | null; basis: 'cupom' | 'janela' | null } {
  if (i.couponCreatedBy) return { recoveredBy: i.couponCreatedBy, basis: 'cupom' };
  if (i.leadUserId && i.leadClaimedAt) {
    const limit = new Date(i.leadClaimedAt).getTime() + (i.windowDays ?? 7) * 86_400_000;
    if (Number.isFinite(limit) && i.paidAt.getTime() <= limit) return { recoveredBy: i.leadUserId, basis: 'janela' };
  }
  return { recoveredBy: null, basis: null };
}
export function commissionValue(total: number | null, pct: number | null): number | null {
  if (total === null || !Number.isFinite(total)) return null;
  return Math.round(total * ((pct ?? 0) / 100) * 100) / 100;
}
type AnyRec = Record<string, unknown>;
const rec = (v: unknown): AnyRec => (v && typeof v === 'object' && !Array.isArray(v) ? v as AnyRec : {});
export function extractFirstSkuId(raw: unknown): number | null {
  const items = rec(rec(rec(raw).resource).items);
  const list = Array.isArray(items.data) ? items.data : Array.isArray(rec(raw).resource && rec(rec(raw).resource).items) ? rec(rec(raw).resource).items as unknown[] : [];
  const first = rec((list as unknown[])[0]);
  const id = rec(rec(first.sku).data).id;
  return typeof id === 'number' && Number.isFinite(id) ? id : (typeof id === 'string' && /^\d+$/.test(id) ? Number(id) : null);
}
```

- [ ] **Step 4: Rodar e ver passar** — 4 passed.

- [ ] **Step 5: `yampi-process-event` — gravar `sku_id` no lead**

Em `moveLead`, adicionar parâmetro `skuId: number | null = null` e usar nos dois ramos: no `update` → `.update({ leads_stages_id: stageId, ...(skuId ? { sku_id: skuId } : {}) })`; no `insert` → `...(skuId ? { sku_id: skuId } : {})`. No caller (l.~325): `const skuId = extractFirstSkuId(event.raw_payload);` e passar como último argumento. Import: `import { decideHumanAttribution, commissionValue, extractFirstSkuId } from '../_shared/comercial-attribution.ts';`.

- [ ] **Step 6: `yampi-process-event` — atribuição humana no `pedido_pago`**

Substituir o bloco que hoje só faz `isOurCoupon = !!cc` por:

```ts
        let isOurCoupon = false;
        let couponCreatedBy: string | null = null;
        if (couponCode) {
          const { data: cc } = await supabase
            .from('crm_coupons').select('id, created_by').eq('code', couponCode).maybeSingle();
          isOurCoupon = !!cc;
          couponCreatedBy = ((cc as { created_by?: string | null } | null)?.created_by) ?? null;
        }
```

Depois de `const attributed = attributionLevel !== null;` inserir:

```ts
        // ── Atribuição HUMANA (COMERCIAL): cupom do comercial > carrinho dele pago em ≤7d ──
        const { data: leadOwnerRaw } = leadId
          ? await supabase.from('leads').select('user_id, claimed_at').eq('id', leadId).maybeSingle()
          : { data: null };
        const leadOwner = leadOwnerRaw as { user_id: string | null; claimed_at: string | null } | null;
        const human = decideHumanAttribution({
          couponCreatedBy, leadUserId: leadOwner?.user_id ?? null, leadClaimedAt: leadOwner?.claimed_at ?? null, paidAt,
        });
        let commissionPct: number | null = null;
        if (human.recoveredBy) {
          const { data: su } = await supabase.from('settings_users').select('commission_pct').eq('id', human.recoveredBy).maybeSingle();
          commissionPct = (su as { commission_pct: number | null } | null)?.commission_pct ?? null;
        }
```

E no `upsert` de `esteira_reconversions` acrescentar os campos:

```ts
          recovered_by: human.recoveredBy,
          recovery_basis: human.basis,
          commission_pct: human.recoveredBy ? (commissionPct ?? 0) : null,
          commission_value: human.recoveredBy ? commissionValue(parsed.total, commissionPct) : null,
```

E no `log.info('reconversion_recorded', …)` acrescentar `recovered_by: human.recoveredBy ?? 'none', basis: human.basis ?? 'none'`.

- [ ] **Step 7: Checar** — `deno check supabase/functions/yampi-process-event/index.ts` → sem erros (a base fecha limpa).

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/_shared/comercial-attribution.ts supabase/functions/_shared/comercial-attribution.test.ts supabase/functions/yampi-process-event/index.ts
git commit -m "feat(comercial): atribuição humana (cupom > janela 7d) com snapshot de comissão no pedido_pago; leads.sku_id"
```

---

### Task 5: Primeiro WhatsApp humano do comercial (`whatsapp-outbound`)

**Files:**
- Create: `supabase/functions/_shared/comercial-contact.ts`, `supabase/functions/_shared/comercial-contact.test.ts`
- Modify: `supabase/functions/whatsapp-outbound/index.ts` (depois do loop de envio, antes de montar `response`, ~l.1404)

**Interfaces:**
- Produces: `shouldHandoffToHuman(i: { senderUserType: string|null; priorHumanSentByUser: number }): boolean`; `async handoffToHumanAfterFirstContact(supabase, { peopleId, userId })` → `{ cancelled: number }`.

- [ ] **Step 1: Teste**

```ts
// supabase/functions/_shared/comercial-contact.test.ts
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { shouldHandoffToHuman } from './comercial-contact.ts';
Deno.test('só comercial, só na primeira mensagem enviada', () => {
  assertEquals(shouldHandoffToHuman({ senderUserType: 'comercial', priorHumanSentByUser: 0 }), true);
  assertEquals(shouldHandoffToHuman({ senderUserType: 'comercial', priorHumanSentByUser: 1 }), false);
  assertEquals(shouldHandoffToHuman({ senderUserType: 'admin', priorHumanSentByUser: 0 }), false);
  assertEquals(shouldHandoffToHuman({ senderUserType: null, priorHumanSentByUser: 0 }), false);
});
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar**

```ts
// supabase/functions/_shared/comercial-contact.ts
/**
 * Primeiro WhatsApp humano de um COMERCIAL para uma pessoa (spec §5.2):
 * cancela só os toques de WhatsApp pendentes dos leads dela e desliga o agente (ai_enabled=false).
 * E-mail e SMS seguem. Idempotente: a partir da 2ª mensagem não faz nada.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export function shouldHandoffToHuman(i: { senderUserType: string | null; priorHumanSentByUser: number }): boolean {
  return i.senderUserType === 'comercial' && i.priorHumanSentByUser === 0;
}

export async function handoffToHumanAfterFirstContact(
  supabase: SupabaseClient, o: { peopleId: string; userId: string },
): Promise<{ cancelled: number }> {
  const { data: leads } = await supabase.from('leads').select('id').eq('people_id', o.peopleId);
  const ids = ((leads ?? []) as Array<{ id: string }>).map((l) => l.id);
  let cancelled = 0;
  if (ids.length > 0) {
    const { data: upd } = await supabase.from('followup_queue')
      .update({ status: 'cancelled', error_message: 'comercial assumiu o WhatsApp' })
      .in('lead_id', ids).eq('channel', 'whatsapp').eq('status', 'pending').select('id');
    cancelled = (upd ?? []).length;
  }
  await supabase.from('clients_people').update({ ai_enabled: false }).eq('id', o.peopleId);
  return { cancelled };
}
```

- [ ] **Step 4: Rodar e ver passar.**

- [ ] **Step 5: Ligar no `whatsapp-outbound`** — logo antes de `const response = {` (após o loop), com `wamids.length > 0 && message_ids?.length && people_id`:

```ts
    // ── COMERCIAL: primeiro WhatsApp humano → cancela WA pendentes e desliga o agente ──
    if (wamids.length > 0 && people_id && Array.isArray(message_ids) && message_ids.length > 0) {
      try {
        const { data: sentRow } = await supabase.from('messages').select('user_id').eq('id', message_ids[0]).maybeSingle();
        const senderId = (sentRow as { user_id: string | null } | null)?.user_id ?? null;
        if (senderId) {
          const [{ data: su }, { count }] = await Promise.all([
            supabase.from('settings_users').select('user_type').eq('id', senderId).maybeSingle(),
            supabase.from('messages').select('id', { count: 'exact', head: true })
              .eq('people_id', people_id).eq('user_id', senderId).not('wa_message_id', 'is', null)
              .not('id', 'in', `(${message_ids.join(',')})`),
          ]);
          const decision = shouldHandoffToHuman({ senderUserType: (su as { user_type: string | null } | null)?.user_type ?? null, priorHumanSentByUser: count ?? 0 });
          if (decision) {
            const r = await handoffToHumanAfterFirstContact(supabase, { peopleId: people_id, userId: senderId });
            log.info('commercial_first_contact', { people_id, user_id: senderId, cancelled: r.cancelled });
          }
        }
      } catch (e) { log.warn('commercial_first_contact_failed', { error: (e as Error).message }); }
    }
```

Import no topo: `import { handoffToHumanAfterFirstContact, shouldHandoffToHuman } from '../_shared/comercial-contact.ts';`. Conferir o nome do logger no arquivo (`log.info`/`log.warn` já usados em l.952).

- [ ] **Step 6: Checar** — `deno check supabase/functions/whatsapp-outbound/index.ts` (comparar contagem de erros com a base: `git show feat/esteira-rodada-3:supabase/functions/whatsapp-outbound/index.ts | wc -l` não ajuda; rodar o check antes de editar e anotar).

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/_shared/comercial-contact.ts supabase/functions/_shared/comercial-contact.test.ts supabase/functions/whatsapp-outbound/index.ts
git commit -m "feat(comercial): primeiro WhatsApp humano do comercial cancela WA pendentes e desliga o agente pra pessoa"
```

---

### Task 6: Template Meta do comercial + stage bloqueado no nudge

**Files:**
- Modify: `supabase/functions/yampi-connect/index.ts` (array `specs` do `bootstrap_wa_templates`, ~l.540–562)
- Modify: `supabase/functions/_shared/click-nudge.ts` l.31; `supabase/functions/_shared/click-nudge.test.ts`

- [ ] **Step 1: Teste do nudge** — acrescentar em `click-nudge.test.ts`, dentro de `'decideNudge: bloqueios'`:

```ts
  assertEquals(decideNudge({ ...base, stageName: 'Em negociação' }).ok, false);  // comercial assumiu
```

- [ ] **Step 2: Rodar e ver falhar** — `deno test --allow-env supabase/functions/_shared/click-nudge.test.ts`.

- [ ] **Step 3: Implementar**

```ts
export const NUDGE_BLOCKED_STAGES: readonly string[] = ['Pagamento pendente', 'Recuperado', 'Perdido', 'Em negociação'];
```

- [ ] **Step 4: Rodar e ver passar.**

- [ ] **Step 5: Template no `yampi-connect`** — acrescentar ao array `specs` (depois de `PIX-WA-03`). `rule_prefix` fica `'COMERCIAL'`: não existe regra com esse prefixo, então o loop de "religar regra" não encontra nada e só cria o template (ver o código abaixo do array: ele procura regra por `rule_prefix`; conferir que um prefixo sem regra não lança erro — se lançar, proteger com `if (sp.rule_prefix !== 'COMERCIAL')`).

```ts
        { rule_prefix: 'COMERCIAL', name: 'minimal_esteira_comercial_cupom', category: 'MARKETING',
          body: 'Oi {{1}}, aqui é {{2}} da Minimal Cases 👋\nVi que sua {{3}} ficou separada no carrinho.\nSeparei um cupom de {{4}}% só pra você: {{5}} — vale até {{6}}.\nQuer que eu te ajude a finalizar?',
          examples: ['Gabriella', 'Hyago', 'Case Minimal Preta', '20', 'GABRIELLA20', '12/09'], params: ['nome', 'remetente', 'produto', 'percentual', 'cupom', 'validade'],
          buttons: [urlBtn('Finalizar com desconto')] },
```

- [ ] **Step 6: Checar** — `deno check supabase/functions/yampi-connect/index.ts`.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/yampi-connect/index.ts supabase/functions/_shared/click-nudge.ts supabase/functions/_shared/click-nudge.test.ts
git commit -m "feat(comercial): template Meta minimal_esteira_comercial_cupom; Em negociação bloqueia o nudge de clique"
```

---

### Task 7: Kanban com colunas virtuais (lib pura + KanbanBoard/StageColumn)

**Files:**
- Create: `src/lib/comercial/kanban.ts`, `src/lib/comercial/kanban.test.ts`
- Modify: `src/components/negocios/KanbanBoard.tsx`, `src/components/negocios/StageColumn.tsx`

**Interfaces:**
- Produces: `COMMERCIAL_POOL_STAGES = ['Carrinho abandonado','Em recuperação','Engajou']`; `type KanbanColumn = { id: string; nome: string; cor?: string|null; stageIds: string[] }`; `buildCommercialColumns(stages: Stage[]): KanbanColumn[]`; `stageColumns(stages: Stage[]): KanbanColumn[]` (1 stage = 1 coluna, como hoje); `groupByColumn(negocios, columns): Record<string, NegocioOptimized[]>`; `ageDays(createdAt: string, now?: Date): number`.
- `KanbanBoard` ganha props opcionais `columns?: KanbanColumn[]`, `readOnly?: boolean`, `renderCardExtra?: (n: NegocioOptimized) => ReactNode`, `showOwnerChip?: boolean`, `skuImages?: Record<number, string>`. `StageColumn` recebe `column: KanbanColumn` (em vez de `stage`), `readOnly`, `renderCardExtra`, `ownerNames?: Record<string,string>`, `skuImages`.

- [ ] **Step 1: Teste**

```ts
// src/lib/comercial/kanban.test.ts
import { describe, expect, it } from 'vitest';
import { buildCommercialColumns, stageColumns, groupByColumn, ageDays, COMMERCIAL_POOL_STAGES } from './kanban';

const st = (id: string, name: string, order_index: number) => ({ id, name, nome: name, order_index, ordem: order_index, leads_pipelines_id: 'P', pipeline_id: 'P', active: true, ativo: true });
const stages = [st('ca', 'Carrinho abandonado', 0), st('er', 'Em recuperação', 1), st('en', 'Engajou', 2), st('neg', 'Em negociação', 3), st('pp', 'Pagamento pendente', 4), st('pr', 'Pagamento recusado', 5), st('rec', 'Recuperado', 6), st('per', 'Perdido', 7)];

describe('buildCommercialColumns', () => {
  it('3 colunas: disponíveis (3 stages), em negociação, recuperado', () => {
    const cols = buildCommercialColumns(stages as never);
    expect(cols.map((c) => c.nome)).toEqual(['Carrinhos disponíveis', 'Em negociação', 'Recuperado']);
    expect(cols[0].stageIds).toEqual(['ca', 'er', 'en']);
    expect(cols[1].stageIds).toEqual(['neg']);
    expect(cols[2].stageIds).toEqual(['rec']);
    expect(COMMERCIAL_POOL_STAGES).toEqual(['Carrinho abandonado', 'Em recuperação', 'Engajou']);
  });
  it('omite coluna cujo stage não existe no pipeline', () => {
    const cols = buildCommercialColumns(stages.filter((s) => s.id !== 'neg') as never);
    expect(cols.map((c) => c.nome)).toEqual(['Carrinhos disponíveis', 'Recuperado']);
  });
});

describe('stageColumns + groupByColumn', () => {
  it('1 stage = 1 coluna; agrupa por stageIds; sem stage válido cai na primeira', () => {
    const cols = stageColumns(stages.slice(0, 2) as never);
    expect(cols.map((c) => c.id)).toEqual(['ca', 'er']);
    const g = groupByColumn([{ id: 'a', leads_stages_id: 'er' }, { id: 'b', leads_stages_id: 'zzz' }] as never, cols);
    expect(g['er'].map((n) => n.id)).toEqual(['a']);
    expect(g['ca'].map((n) => n.id)).toEqual(['b']);
  });
  it('colunas compostas somam os stages', () => {
    const cols = buildCommercialColumns(stages as never);
    const g = groupByColumn([{ id: 'a', leads_stages_id: 'ca' }, { id: 'b', leads_stages_id: 'en' }, { id: 'c', leads_stages_id: 'neg' }] as never, cols);
    expect(g[cols[0].id].map((n) => n.id)).toEqual(['a', 'b']);
    expect(g['neg'].map((n) => n.id)).toEqual(['c']);
  });
});

describe('ageDays', () => {
  it('dias inteiros desde created_at', () => {
    expect(ageDays('2026-09-01T12:00:00Z', new Date('2026-09-20T11:00:00Z'))).toBe(18);
    expect(ageDays('2026-09-20T10:00:00Z', new Date('2026-09-20T11:00:00Z'))).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run src/lib/comercial/kanban.test.ts`.

- [ ] **Step 3: Implementar a lib**

```ts
// src/lib/comercial/kanban.ts
import type { Stage } from '@/hooks/usePipelines';
import type { NegocioOptimized } from '@/hooks/useNegociosOptimized';

export const COMMERCIAL_POOL_STAGES = ['Carrinho abandonado', 'Em recuperação', 'Engajou'] as const;
export const COMMERCIAL_POOL_COLUMN_ID = 'pool';

export interface KanbanColumn { id: string; nome: string; cor?: string | null; stageIds: string[] }

export function stageColumns(stages: Stage[]): KanbanColumn[] {
  return stages.map((s) => ({ id: s.id, nome: s.nome ?? s.name, cor: s.cor ?? s.color ?? null, stageIds: [s.id] }));
}

/** Visão do comercial: pool (3 stages) → Em negociação → Recuperado. Coluna sem stage no pipeline é omitida. */
export function buildCommercialColumns(stages: Stage[]): KanbanColumn[] {
  const byName = new Map(stages.map((s) => [s.nome ?? s.name, s]));
  const pool = COMMERCIAL_POOL_STAGES.map((n) => byName.get(n)).filter((s): s is Stage => !!s);
  const out: KanbanColumn[] = [];
  if (pool.length > 0) out.push({ id: COMMERCIAL_POOL_COLUMN_ID, nome: 'Carrinhos disponíveis', cor: pool[0].cor ?? pool[0].color ?? null, stageIds: pool.map((s) => s.id) });
  for (const name of ['Em negociação', 'Recuperado'] as const) {
    const s = byName.get(name);
    if (s) out.push({ id: s.id, nome: name, cor: s.cor ?? s.color ?? null, stageIds: [s.id] });
  }
  return out;
}

export function groupByColumn(negocios: NegocioOptimized[], columns: KanbanColumn[]): Record<string, NegocioOptimized[]> {
  const byStage = new Map<string, string>();
  for (const c of columns) for (const sid of c.stageIds) byStage.set(sid, c.id);
  const out: Record<string, NegocioOptimized[]> = {};
  for (const c of columns) out[c.id] = [];
  const first = columns[0]?.id;
  for (const n of negocios) {
    const col = byStage.get(n.leads_stages_id) ?? first;
    if (col) out[col].push(n);
  }
  return out;
}

export function ageDays(createdAt: string, now = new Date()): number {
  const ms = now.getTime() - new Date(createdAt).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}
```

- [ ] **Step 4: Rodar e ver passar.**

- [ ] **Step 5: `KanbanBoard.tsx` aceita colunas compostas.** Mudanças (manter tudo o mais igual):

```tsx
import { groupByColumn, stageColumns, type KanbanColumn } from "@/lib/comercial/kanban";
import type { ReactNode } from "react";
// props novas (todas opcionais):
//   columns?: KanbanColumn[]; readOnly?: boolean; renderCardExtra?: (n: NegocioOptimized) => ReactNode;
//   ownerNames?: Record<string, string>; skuImages?: Record<number, string>;
const cols = useMemo(() => columns ?? stageColumns(stages), [columns, stages]);
const pipelineStageIds = useMemo(() => cols.flatMap((c) => c.stageIds), [cols]);
// useNegociosByStage continua igual (agrupa por stage); reagrupar por coluna:
const { negociosByStage, totalByStage, isLoading } = useNegociosByStage(pipelineId || '', pipelineStageIds, {...});
const allNegocios = useMemo(() => Object.values(negociosByStage).flat(), [negociosByStage]);
const negociosByColumn = useMemo(() => groupByColumn(allNegocios, cols), [allNegocios, cols]);
const totalByColumn = useMemo(() => Object.fromEntries(cols.map((c) => [c.id, c.stageIds.reduce((a, s) => a + (totalByStage[s] ?? 0), 0)])), [cols, totalByStage]);
const displayColumns = useMemo(() => (!stageFilter ? cols : cols.filter((c) => c.id === stageFilter || c.stageIds.includes(stageFilter))), [cols, stageFilter]);
// handleDragEnd: se readOnly → return no início. destination.droppableId agora é o id da COLUNA;
// o stage alvo é cols.find(c => c.id === destination.droppableId)?.stageIds[0] — usar esse nos updates.
// PipelineFunnelStrip recebe cols.map(c => ({ id: c.id, nome: c.nome, cor: c.cor, count: negociosByColumn[c.id]?.length ?? 0 })).
// Render: displayColumns.map(col => <StageColumn key={col.id} column={col} negocios={negociosByColumn[col.id] || []} totalValue={totalByColumn[col.id] || 0} isLoading={isLoading} totalLeads={totalLeads} pipelineId={pipelineId || ''} readOnly={readOnly} renderCardExtra={renderCardExtra} ownerNames={ownerNames} skuImages={skuImages} />)
```

- [ ] **Step 6: `StageColumn.tsx`** — trocar a prop `stage: Stage` por `column: KanbanColumn` (usos: `stage.id` → `column.id`, `stage.nome` → `column.nome`, `stage.cor` → `column.cor`); `Droppable droppableId={column.id}`; `Draggable isDragDisabled={readOnly}`; no card, logo após o bloco `{/* 2 · o quê */}`:

```tsx
                                {(() => { const url = negocio.sku_id && skuImages ? skuImages[negocio.sku_id] : null; return url ? <img src={url} alt="" className="w-10 h-10 rounded-lg object-cover bg-muted" loading="lazy" /> : null; })()}
                                {ownerNames && negocio.user_id && ownerNames[negocio.user_id] && (
                                  <Chip tone="info" title="Comercial responsável">Comercial: {ownerNames[negocio.user_id]}</Chip>
                                )}
                                {renderCardExtra?.(negocio)}
```

Em `NegocioOptimized` (`src/hooks/useNegociosOptimized.ts`) acrescentar `sku_id?: number | null; claimed_at?: string | null;` e conferir que o `select` de `useNegociosPipeline` traz `sku_id, claimed_at` (se o select é `'*'` ou lista explícita, acrescentar os dois campos).

O menu "Marcar como Perdido" do card fica escondido quando `readOnly`.

- [ ] **Step 7: Testes e build**

```bash
npm test 2>&1 | tail -3          # todos passando (68 + 5 novos)
npx vite build 2>&1 | tail -2    # build ok
```

- [ ] **Step 8: Commit**

```bash
git add src/lib/comercial/kanban.ts src/lib/comercial/kanban.test.ts src/components/negocios/KanbanBoard.tsx src/components/negocios/StageColumn.tsx src/hooks/useNegociosOptimized.ts
git commit -m "feat(kanban): colunas compostas (N stages por coluna), modo readOnly, miniatura do SKU e chip do comercial"
```

---

### Task 8: Hooks do comercial e modo comercial em `Negocios.tsx`

**Files:**
- Create: `src/hooks/useComercial.ts`
- Modify: `src/pages/Negocios.tsx`

**Interfaces:**
- Consumes: `buildCommercialColumns`, `ageDays` (Task 7); RPC `claim_lead`; function `commercial-coupon-create` (Task 3); `useUserPermissions().isComercial/currentUserId`.
- Produces: `useCommercialScope(): { isComercial: boolean; currentUserId: string | null }`; `useClaimLead(): UseMutationResult<{ok:boolean; reason?:string}, Error, string>`; `useSkuImages(skuIds: number[]): UseQueryResult<Record<number,string>>`; `useLeadCoupon(leadId): UseQueryResult<{ code: string; percent: number|null; expires_at: string|null } | null>`; `useCreateCommercialCoupon(): UseMutationResult<CouponCreateResponse, Error, { lead_id: string; percent: number; validity_days?: number }>`; `type CouponCreateResponse` = resposta `ok:true` da Task 3.

- [ ] **Step 1: Implementar o hook**

```ts
// src/hooks/useComercial.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useUserPermissions } from '@/hooks/useUserPermissions';

const db = supabase as unknown as SupabaseClient;

export function useCommercialScope() {
  const { isComercial, currentUserId } = useUserPermissions();
  return { isComercial, currentUserId: currentUserId ?? null };
}

export function useClaimLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (leadId: string): Promise<{ ok: boolean; reason?: string }> => {
      const { data, error } = await db.rpc('claim_lead', { p_lead_id: leadId });
      if (error) throw error;
      return (data ?? { ok: false, reason: 'fora_do_pool' }) as { ok: boolean; reason?: string };
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['negocios-pipeline'] });
      qc.invalidateQueries({ queryKey: ['negocio'] });
    },
  });
}

/** Foto da capa por SKU (cache yampi_sku_images). Uma query por board. */
export function useSkuImages(skuIds: number[]) {
  const ids = [...new Set(skuIds.filter((n) => Number.isFinite(n)))].sort((a, b) => a - b);
  return useQuery({
    queryKey: ['sku-images', ids.join(',')],
    enabled: ids.length > 0,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<Record<number, string>> => {
      const { data, error } = await db.from('yampi_sku_images').select('sku_id, url').in('sku_id', ids);
      if (error) throw error;
      return Object.fromEntries(((data ?? []) as Array<{ sku_id: number; url: string }>).map((r) => [r.sku_id, r.url]));
    },
  });
}

export function useLeadCoupon(leadId?: string) {
  return useQuery({
    queryKey: ['lead-coupon', leadId],
    enabled: !!leadId,
    queryFn: async () => {
      const { data, error } = await db.from('crm_coupons').select('code, percent, expires_at, created_by')
        .eq('lead_id', leadId!).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return (data ?? null) as { code: string; percent: number | null; expires_at: string | null; created_by: string | null } | null;
    },
  });
}

export interface CouponCreateResponse {
  ok: true; code: string; percent: number; expires_at: string | null; reused: boolean;
  price: number | null; price_with_coupon: number | null; price_label: string; price_with_coupon_label: string;
  cart_url: string | null; tracked_url: string | null; message_preview: string;
}

export function useCreateCommercialCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { lead_id: string; percent: number; validity_days?: number }): Promise<CouponCreateResponse> => {
      const { data, error } = await supabase.functions.invoke('commercial-coupon-create', { body: input });
      if (error) throw new Error(error.message);
      const r = data as CouponCreateResponse | { ok: false; error: string };
      if (!r.ok) throw new Error((r as { error: string }).error);
      return r;
    },
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ['lead-coupon', v.lead_id] });
      qc.invalidateQueries({ queryKey: ['negocios-pipeline'] });
      qc.invalidateQueries({ queryKey: ['negocio'] });
    },
  });
}
```

- [ ] **Step 2: `Negocios.tsx` — modo comercial**

```tsx
import { useCommercialScope, useClaimLead, useSkuImages } from "@/hooks/useComercial";
import { buildCommercialColumns, ageDays } from "@/lib/comercial/kanban";
import { Chip } from "@/components/ui/chip";
import { Clock } from "lucide-react";
import { toast } from "sonner";
// dentro do componente:
const { isComercial } = useCommercialScope();
const claim = useClaimLead();
const commercialColumns = useMemo(() => (isComercial ? buildCommercialColumns(pipelineStages) : undefined), [isComercial, pipelineStages]);
// ownerNames para admin/gestor (usuarios já carregado por useUsuarios):
const ownerNames = useMemo(() => Object.fromEntries((usuarios as Array<{ id: string; nome?: string; name?: string }>).map((u) => [u.id, u.nome ?? u.name ?? ''])), [usuarios]);
// skuImages: coletar sku_id dos negócios visíveis — o KanbanBoard já carrega os negócios; pra não duplicar a query,
// o KanbanBoard passa a aceitar `skuImages` calculado aqui a partir de useNegociosPipeline(pipelineFilter, {}) .
const { data: negociosDoBoard = [] } = useNegociosPipeline(pipelineFilter ?? '', {});
const { data: skuImages = {} } = useSkuImages(negociosDoBoard.map((n) => n.sku_id).filter((v): v is number => typeof v === 'number'));

const renderCardExtra = isComercial ? (n: NegocioOptimized) => {
  const d = ageDays(n.created_at);
  const disponivel = !n.user_id;
  return (
    <div className="flex items-center justify-between pt-1.5">
      <Chip icon={Clock} tone={d >= 30 ? 'danger' : 'warning'} title="Idade do carrinho">há {d} dias</Chip>
      {disponivel && (
        <Button size="sm" className="h-7 text-[12px]" disabled={claim.isPending}
          onClick={(e) => { e.stopPropagation(); claim.mutate(n.id, { onSuccess: (r) => r.ok ? toast.success('Carrinho é seu — está em Em negociação') : toast.error(r.reason === 'ja_assumido' ? 'Outro comercial pegou este carrinho' : 'Carrinho fora do pool') }); }}>
          Assumir
        </Button>
      )}
    </div>
  );
} : undefined;
```

No JSX: `NegociosToolbar` recebe `compact={isComercial}` (nova prop booleana: quando true esconde seletor de pipeline, botão de criar, filtros de time/responsável/status/mais filtros e mover em massa — só busca + atualizar); `KanbanBoard` recebe `columns={commercialColumns} readOnly={isComercial} renderCardExtra={renderCardExtra} ownerNames={isComercial ? undefined : ownerNames} skuImages={skuImages}`; `NovoNegocioModal` só renderiza se `!isComercial`. Em `NegociosToolbar.tsx`, implementar `compact` com early-return dos blocos correspondentes (não remover nada do fluxo atual).

- [ ] **Step 3: Tipos e build**

```bash
npx vite build 2>&1 | tail -2
npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -E "useComercial|Negocios.tsx|NegociosToolbar|KanbanBoard|StageColumn" | head   # esperado: nada
```

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useComercial.ts src/pages/Negocios.tsx src/components/negocios/NegociosToolbar.tsx
git commit -m "feat(comercial): kanban do comercial — 3 colunas virtuais, sem drag, botão Assumir, idade do carrinho; miniatura e chip do dono pro admin"
```

---

### Task 9: Detalhe do lead — prévia da capa, bloco Comercial, draft na conversa

**Files:**
- Create: `src/lib/comercial/coupon.ts`, `src/lib/comercial/coupon.test.ts`, `src/components/negocios/NegocioComercialCard.tsx`
- Modify: `src/components/negocios/NegocioEsteira.tsx` (bloco Carrinho ~l.120–145; botão Pausar toques ~l.113), `src/pages/Conversas.tsx` (l.224), `src/pages/NegocioSingle.tsx` (l.694)

**Interfaces:**
- Consumes: `useClaimLead`, `useLeadCoupon`, `useCreateCommercialCoupon`, `useCommercialScope`, `useSkuImages` (Task 8).
- Produces: `priceWithCoupon(total, percent)`, `couponExpiryLabel(iso)`; componente `NegocioComercialCard({ leadId, peopleId, ownerId, ownerName, cartTotal })`.

- [ ] **Step 1: Teste da lib**

```ts
// src/lib/comercial/coupon.test.ts
import { describe, expect, it } from 'vitest';
import { priceWithCoupon, couponExpiryLabel, COMMERCIAL_PERCENTS } from './coupon';
describe('coupon', () => {
  it('preço com desconto em centavos', () => { expect(priceWithCoupon(159.9, 20)).toBe(127.92); expect(priceWithCoupon(null, 20)).toBeNull(); });
  it('percentuais do comercial', () => { expect(COMMERCIAL_PERCENTS).toEqual([5, 10, 15, 20]); });
  it('label de validade dd/MM', () => { expect(couponExpiryLabel('2026-09-12T23:59:00-03:00')).toBe('12/09'); expect(couponExpiryLabel(null)).toBe('—'); });
});
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar**

```ts
// src/lib/comercial/coupon.ts
import { format } from 'date-fns';
export const COMMERCIAL_PERCENTS = [5, 10, 15, 20] as const;
export function priceWithCoupon(total: number | null, percent: number): number | null {
  if (total === null || !Number.isFinite(total)) return null;
  return Math.round(total * (1 - percent / 100) * 100) / 100;
}
export function couponExpiryLabel(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? format(d, 'dd/MM') : '—';
}
```

- [ ] **Step 4: Rodar e ver passar.**

- [ ] **Step 5: `NegocioComercialCard.tsx`**

```tsx
// src/components/negocios/NegocioComercialCard.tsx
/** Bloco "Comercial" da aba Esteira: Assumir · Gerar cupom (5/10/15/20) · cupom ativo · Abrir conversa. */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Copy, MessageSquare, Ticket } from 'lucide-react';
import { toast } from 'sonner';
import { useClaimLead, useCommercialScope, useCreateCommercialCoupon, useLeadCoupon } from '@/hooks/useComercial';
import { COMMERCIAL_PERCENTS, couponExpiryLabel, priceWithCoupon } from '@/lib/comercial/coupon';

const money = (v: number | null) => v === null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

interface Props { leadId: string; peopleId?: string | null; ownerId?: string | null; ownerName?: string | null; cartTotal: number | null }

export default function NegocioComercialCard({ leadId, peopleId, ownerId, ownerName, cartTotal }: Props) {
  const { isComercial, currentUserId } = useCommercialScope();
  const claim = useClaimLead();
  const create = useCreateCommercialCoupon();
  const { data: coupon } = useLeadCoupon(leadId);
  const [percent, setPercent] = useState<number>(10);
  const [days, setDays] = useState<number>(3);
  const [preview, setPreview] = useState<string | null>(null);
  const navigate = useNavigate();

  const mine = !!ownerId && ownerId === currentUserId;
  const semDono = !ownerId;
  if (!isComercial && semDono) return null;   // admin só vê o bloco quando há dono

  const ativo = coupon && coupon.expires_at && new Date(coupon.expires_at) > new Date() ? coupon : null;

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Ticket className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
        <span className="text-[13px] font-medium text-foreground">Comercial</span>
        {ownerId && <Chip tone="info">{mine ? 'Seu carrinho' : `Com ${ownerName ?? 'outro comercial'}`}</Chip>}
      </div>

      {isComercial && semDono && (
        <Button size="sm" className="h-8 text-[12px]" disabled={claim.isPending}
          onClick={() => claim.mutate(leadId, { onSuccess: (r) => r.ok ? toast.success('Carrinho é seu') : toast.error(r.reason === 'ja_assumido' ? 'Outro comercial pegou este carrinho' : 'Carrinho fora do pool') })}>
          Assumir carrinho
        </Button>
      )}

      {(mine || !isComercial) && ownerId && (
        <>
          {ativo ? (
            <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
              <span className="font-mono font-semibold">{ativo.code}</span>
              <Chip>{ativo.percent ?? '?'}%</Chip>
              {cartTotal !== null && ativo.percent && <span className="text-muted-foreground">{money(cartTotal)} → <span className="text-foreground font-medium">{money(priceWithCoupon(cartTotal, ativo.percent))}</span></span>}
              <span className="text-muted-foreground">vence {couponExpiryLabel(ativo.expires_at)}</span>
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => { navigator.clipboard.writeText(ativo.code); toast.success('Cupom copiado'); }}><Copy className="w-3.5 h-3.5" /></Button>
            </div>
          ) : mine && (
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground">Desconto</p>
                <div className="flex rounded-lg border border-border overflow-hidden">
                  {COMMERCIAL_PERCENTS.map((p) => (
                    <button key={p} type="button" onClick={() => setPercent(p)}
                      className={`px-3 h-8 text-[12px] ${percent === p ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground hover:bg-muted'}`}>{p}%</button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground">Validade (dias)</p>
                <input type="number" min={1} max={7} value={days} onChange={(e) => setDays(Math.min(7, Math.max(1, Number(e.target.value) || 3)))} className="h-8 w-16 rounded-lg border border-border bg-background px-2 text-[12px]" />
              </div>
              {cartTotal !== null && <span className="text-[12px] text-muted-foreground pb-2">{money(cartTotal)} → {money(priceWithCoupon(cartTotal, percent))}</span>}
              <Button size="sm" className="h-8 text-[12px]" disabled={create.isPending}
                onClick={() => create.mutate({ lead_id: leadId, percent, validity_days: days }, {
                  onSuccess: (r) => { setPreview(r.message_preview); toast.success(r.reused ? 'Cupom já existia — reaproveitado' : `Cupom ${r.code} criado`); },
                  onError: (e) => toast.error(e.message),
                })}>
                Gerar cupom
              </Button>
            </div>
          )}
          {(preview || ativo) && peopleId && (
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[12px]"
              onClick={() => navigate(`/omni?pessoaId=${peopleId}${preview ? `&draft=${encodeURIComponent(preview)}` : ''}`)}>
              <MessageSquare className="w-3.5 h-3.5" strokeWidth={1.5} />Abrir conversa
            </Button>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 6: `NegocioEsteira.tsx`** — (a) prévia da capa: substituir o `<img … w-14 h-14 …>` por

```tsx
            {(cart?.image || skuImage) && (
              <img src={cart?.image ?? skuImage!} alt="" className="w-[120px] h-[120px] md:w-[200px] md:h-[200px] rounded-xl object-cover bg-muted shrink-0" />
            )}
```

com `const { data: skuImgs } = useSkuImages(skuId ? [skuId] : []); const skuImage = skuId ? skuImgs?.[skuId] ?? null : null;` — `skuId` vem de uma nova prop `skuId?: number | null` do componente (NegocioSingle passa `negocio?.sku_id`). (b) Esconder "Pausar toques" quando `isComercial` (`useCommercialScope`). (c) Renderizar `<NegocioComercialCard leadId={leadId} peopleId={peopleId} ownerId={ownerId} ownerName={ownerName} cartTotal={cart?.total ?? null} />` logo acima do bloco Carrinho, com novas props `ownerId?: string | null; ownerName?: string | null`. Em `NegocioSingle.tsx` l.694: `<NegocioEsteira leadId={id!} peopleId={…} skuId={negocio?.sku_id ?? null} ownerId={negocio?.user_id ?? null} ownerName={usuarios.find(u => u.id === negocio?.user_id)?.nome ?? null} />` (se `useUsuarios` não estiver importado ali, importar; comercial não vê colegas, então `ownerName` fica null pra ele — o card já trata).

- [ ] **Step 7: `Conversas.tsx` l.224** — `const [novaMensagem, setNovaMensagem] = useState(() => searchParams.get('draft') ?? "");`

- [ ] **Step 8: Testes + build** — `npm test 2>&1 | tail -2` · `npx vite build 2>&1 | tail -2`.

- [ ] **Step 9: Commit**

```bash
git add src/lib/comercial/coupon.ts src/lib/comercial/coupon.test.ts src/components/negocios/NegocioComercialCard.tsx src/components/negocios/NegocioEsteira.tsx src/pages/NegocioSingle.tsx src/pages/Conversas.tsx
git commit -m "feat(comercial): bloco Comercial no lead (assumir, cupom 5–20%, abrir conversa com draft); prévia da capa 200px"
```

---

### Task 10: BI — comissões (lib + card + hook + scope)

**Files:**
- Create: `src/lib/bi/comissoes.ts`, `src/lib/bi/comissoes.test.ts`, `src/components/dashboard/reconversao/CommissionsCard.tsx`
- Modify: `src/hooks/useReconversaoBI.ts`, `src/components/dashboard/BIProReconversaoTab.tsx`

**Interfaces:**
- Produces: `type ComissaoRow = { recovered_by: string|null; recovery_basis: 'cupom'|'janela'|null; commission_pct: number|null; commission_value: number|null; order_total: number|null; paid_at: string }`; `aggregateComissoes(rows, names: Record<string,string>): ComissaoLinha[]` com `ComissaoLinha = { mes: 'YYYY-MM'; comercialId: string|null; comercial: string; pedidos: number; receita: number; porCupom: number; porJanela: number; pctMedio: number|null; comissao: number }`; `comissoesToCsv(linhas): string`.
- `ReconversionRow` ganha `recovered_by`, `recovery_basis`, `commission_pct`, `commission_value`; `ReconversaoBI` ganha `comissoes: ComissaoLinha[]` e `comissaoPeriodo: number`.
- `BIProReconversaoTab` ganha prop `scope: 'admin' | 'comercial'`.

- [ ] **Step 1: Teste**

```ts
// src/lib/bi/comissoes.test.ts
import { describe, expect, it } from 'vitest';
import { aggregateComissoes, comissoesToCsv } from './comissoes';
const rows = [
  { recovered_by: 'A', recovery_basis: 'cupom', commission_pct: 3, commission_value: 4.8, order_total: 159.9, paid_at: '2026-09-20T12:00:00Z' },
  { recovered_by: 'A', recovery_basis: 'janela', commission_pct: 3, commission_value: 3, order_total: 100, paid_at: '2026-09-25T12:00:00Z' },
  { recovered_by: 'B', recovery_basis: 'cupom', commission_pct: 5, commission_value: 10, order_total: 200, paid_at: '2026-10-01T12:00:00Z' },
  { recovered_by: null, recovery_basis: null, commission_pct: null, commission_value: null, order_total: 80, paid_at: '2026-09-21T12:00:00Z' },
] as const;
describe('aggregateComissoes', () => {
  it('agrupa mês × comercial; esteira automática separada sem comissão', () => {
    const out = aggregateComissoes([...rows] as never, { A: 'Ana', B: 'Bia' });
    expect(out.map((l) => [l.mes, l.comercial, l.pedidos, l.receita, l.porCupom, l.porJanela, l.comissao])).toEqual([
      ['2026-10', 'Bia', 1, 200, 1, 0, 10],
      ['2026-09', 'Ana', 2, 259.9, 1, 1, 7.8],
      ['2026-09', 'Esteira automática', 1, 80, 0, 0, 0],
    ]);
    expect(out[1].pctMedio).toBe(3);
    expect(out[2].pctMedio).toBeNull();
  });
});
describe('comissoesToCsv', () => {
  it('cabeçalho e ; como separador; neutraliza fórmula', () => {
    const csv = comissoesToCsv([{ mes: '2026-09', comercialId: 'A', comercial: '=HYPERLINK("x")', pedidos: 1, receita: 10, porCupom: 1, porJanela: 0, pctMedio: 3, comissao: 0.3 }]);
    expect(csv.split('\n')[0]).toBe('mes;comercial;pedidos;receita;por_cupom;por_janela;pct_medio;comissao');
    expect(csv.split('\n')[1].startsWith("2026-09;\"'=HYPERLINK")).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar**

```ts
// src/lib/bi/comissoes.ts
export interface ComissaoRow { recovered_by: string | null; recovery_basis: 'cupom' | 'janela' | null; commission_pct: number | null; commission_value: number | null; order_total: number | null; paid_at: string }
export interface ComissaoLinha { mes: string; comercialId: string | null; comercial: string; pedidos: number; receita: number; porCupom: number; porJanela: number; pctMedio: number | null; comissao: number }

const round2 = (v: number) => Math.round(v * 100) / 100;

export function aggregateComissoes(rows: ComissaoRow[], names: Record<string, string>): ComissaoLinha[] {
  const map = new Map<string, ComissaoLinha & { pctSum: number; pctN: number }>();
  for (const r of rows) {
    const mes = r.paid_at.slice(0, 7);
    const key = `${mes}|${r.recovered_by ?? ''}`;
    const cur = map.get(key) ?? { mes, comercialId: r.recovered_by, comercial: r.recovered_by ? (names[r.recovered_by] ?? 'Comercial') : 'Esteira automática', pedidos: 0, receita: 0, porCupom: 0, porJanela: 0, pctMedio: null, comissao: 0, pctSum: 0, pctN: 0 };
    cur.pedidos++; cur.receita = round2(cur.receita + (r.order_total ?? 0));
    if (r.recovery_basis === 'cupom') cur.porCupom++; if (r.recovery_basis === 'janela') cur.porJanela++;
    if (r.recovered_by) { cur.comissao = round2(cur.comissao + (r.commission_value ?? 0)); if (r.commission_pct !== null) { cur.pctSum += r.commission_pct; cur.pctN++; } }
    map.set(key, cur);
  }
  return [...map.values()]
    .map(({ pctSum, pctN, ...l }) => ({ ...l, pctMedio: pctN > 0 ? round2(pctSum / pctN) : null }))
    .sort((a, b) => (a.mes !== b.mes ? (a.mes < b.mes ? 1 : -1) : (a.comercialId === null ? 1 : b.comercialId === null ? -1 : a.comercial.localeCompare(b.comercial))));
}

const csvCell = (v: unknown) => { let s = String(v ?? ''); if (/^[=+\-@]/.test(s)) s = `'${s}`; return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function comissoesToCsv(linhas: ComissaoLinha[]): string {
  const head = 'mes;comercial;pedidos;receita;por_cupom;por_janela;pct_medio;comissao';
  return [head, ...linhas.map((l) => [l.mes, l.comercial, l.pedidos, l.receita, l.porCupom, l.porJanela, l.pctMedio ?? '', l.comissao].map(csvCell).join(';'))].join('\n');
}
```

- [ ] **Step 4: Rodar e ver passar.**

- [ ] **Step 5: `useReconversaoBI.ts`** — em `ReconversionRow` acrescentar `recovered_by: string | null; recovery_basis: 'cupom' | 'janela' | null; commission_pct: number | null; commission_value: number | null;`. Em `ReconversaoBI` acrescentar `comissoes: ComissaoLinha[]; comissaoPeriodo: number;`. No `queryFn`, depois de montar `all`: buscar nomes dos comerciais envolvidos (`settings_users` `in('id', recoveredIds)` — para comercial a RLS devolve só ele, o que basta) e:

```ts
      const comissoes = aggregateComissoes(all as never, namesById);
      const comissaoPeriodo = all.reduce((a, r) => a + (r.commission_value ?? 0), 0);
```

e devolver ambos. Import: `import { aggregateComissoes, type ComissaoLinha } from '@/lib/bi/comissoes';`.

- [ ] **Step 6: `CommissionsCard.tsx`**

```tsx
// src/components/dashboard/reconversao/CommissionsCard.tsx
import { Download } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { fmtBRL } from '@/components/dashboard/bipro-shared';
import { comissoesToCsv, type ComissaoLinha } from '@/lib/bi/comissoes';

export default function CommissionsCard({ linhas }: { linhas: ComissaoLinha[] }) {
  const exportar = () => {
    const blob = new Blob(['﻿' + comissoesToCsv(linhas)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `comissoes-${format(new Date(), 'yyyyMMdd')}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div><p className="text-[13px] font-medium text-foreground">Comissões por comercial</p><p className="text-[11px] text-muted-foreground">Pedidos recuperados por pessoa, por mês — base cupom ou janela de 7 dias</p></div>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[12px]" onClick={exportar} disabled={linhas.length === 0}><Download className="h-3.5 w-3.5" strokeWidth={1.5} />CSV</Button>
      </div>
      {linhas.length === 0 ? <p className="text-[12px] text-muted-foreground">Nenhuma recuperação no período.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead className="text-[11px] uppercase tracking-wide text-muted-foreground/70"><tr><th className="text-left py-1.5">Mês</th><th className="text-left">Comercial</th><th className="text-right">Pedidos</th><th className="text-right">Receita</th><th className="text-right">Cupom</th><th className="text-right">Janela</th><th className="text-right">%</th><th className="text-right">Comissão</th></tr></thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={`${l.mes}|${l.comercialId ?? 'auto'}`} className="border-t border-border/60">
                  <td className="py-1.5 tabular-nums">{l.mes}</td><td className={l.comercialId ? '' : 'text-muted-foreground'}>{l.comercial}</td>
                  <td className="text-right tabular-nums">{l.pedidos}</td><td className="text-right tabular-nums">{fmtBRL(l.receita)}</td>
                  <td className="text-right tabular-nums">{l.porCupom}</td><td className="text-right tabular-nums">{l.porJanela}</td>
                  <td className="text-right tabular-nums">{l.pctMedio === null ? '—' : `${l.pctMedio}%`}</td>
                  <td className="text-right tabular-nums font-medium">{l.comercialId ? fmtBRL(l.comissao) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 7: `BIProReconversaoTab.tsx`** — prop `scope: 'admin' | 'comercial'` (default `'admin'`). Para `comercial`: não renderiza `InsightsStrip` nem `AbTestCard`; acima de `KpiHero` mostra um `StatCard` "Comissão no período" com `fmtBRL(data.comissaoPeriodo)` (`StatCard` de `@/components/ui/stat-card`, mesmo uso do `KpiHero`). Para `admin`: renderiza `<motion.div variants={cardV}><CommissionsCard linhas={data.comissoes} /></motion.div>` depois da `ReconversionsTable`.

- [ ] **Step 8: Testes + build** — `npm test 2>&1 | tail -2` · `npx vite build 2>&1 | tail -2`.

- [ ] **Step 9: Commit**

```bash
git add src/lib/bi/comissoes.ts src/lib/bi/comissoes.test.ts src/components/dashboard/reconversao/CommissionsCard.tsx src/hooks/useReconversaoBI.ts src/components/dashboard/BIProReconversaoTab.tsx
git commit -m "feat(bi): comissões por comercial (mês × pessoa, CSV) e escopo comercial na aba Reconversão"
```

---

### Task 11: BI só Reconversão pro comercial, sidebar e rota inicial

**Files:**
- Create: `src/components/auth/HomeRedirect.tsx`
- Modify: `src/pages/Dashboard.tsx`, `src/components/layout/DashLayout.tsx`, `src/App.tsx`

- [ ] **Step 1: `HomeRedirect.tsx`**

```tsx
// src/components/auth/HomeRedirect.tsx
import { Navigate } from 'react-router-dom';
import { useUserPermissions } from '@/hooks/useUserPermissions';
/** Comercial entra no kanban (o trabalho dele); todo mundo mais no BI, como hoje. */
export default function HomeRedirect() {
  const { isComercial, isValid } = useUserPermissions();
  if (!isValid) return null;
  return <Navigate to={isComercial ? '/crm/kanban' : '/bipro'} replace />;
}
```

- [ ] **Step 2: `App.tsx`** — trocar `<Route path="/" element={<Navigate to="/bipro" replace />} />` (l.144) e os `index` de `/bipro` (l.~236) e `/dashboard` (l.~236 do bloco legacy) por `<HomeRedirect />` onde hoje navega pra `/bipro`. Conferir que a rota do kanban é `/crm/kanban` (é a usada nos cards: `navigate('/crm/kanban/${id}')`).

- [ ] **Step 3: `DashLayout.tsx`** — em `SidebarItem` acrescentar `allowComercial?: boolean`; no item BI PRO™ adicionar `allowComercial: true`; no filtro dos fixos:

```ts
    const { isComercial } = useUserPermissions();   // já importado no arquivo; extrair isComercial junto de isCliente/isProvisional
    activeItems.push(...fixedSidebarItems.filter(item => !item.requireGestor || isGestorOrAdmin || (item.allowComercial && isComercial)));
```

- [ ] **Step 4: `Dashboard.tsx`** — `const { isComercial } = useUserPermissions();` e `const tabs = useMemo(() => (isComercial ? allTabs.filter((t) => t.key === 'reconversao') : allTabs), …)` onde `allTabs` é a lista atual; quando `isComercial`, esconder o botão "Meta Sync" e passar `scope={isComercial ? 'comercial' : 'admin'}` ao `BIProReconversaoTab`. Se a lista de tabs for um `const` fora do componente, renomear para `ALL_TABS` e filtrar dentro.

- [ ] **Step 5: Build + tsc filtrado**

```bash
npx vite build 2>&1 | tail -2
npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -E "HomeRedirect|Dashboard.tsx|DashLayout.tsx|App.tsx" | head
```

- [ ] **Step 6: Commit**

```bash
git add src/components/auth/HomeRedirect.tsx src/pages/Dashboard.tsx src/components/layout/DashLayout.tsx src/App.tsx
git commit -m "feat(comercial): BI só Reconversão, sidebar com BI liberado pro comercial, entrada direto no kanban"
```

---

### Task 12: Campo Comissão (%) no usuário

**Files:**
- Modify: `src/types/usuarios.ts`, `src/hooks/useUsersNew.ts`, `src/components/modals/EditarUsuarioModal.tsx`, `src/components/config/UsuariosConfig.tsx`

- [ ] **Step 1: Tipos** — em `Usuario` (types) e `User` (useUsersNew) acrescentar `commission_pct?: number | null;`.

- [ ] **Step 2: `useUsersNew.ts`** — no `useUpdateUser` (mapeamento `mappedUpdates`), `commission_pct` passa direto (nome igual no banco); nada a mapear, só garantir que o tipo do parâmetro aceita o campo.

- [ ] **Step 3: `EditarUsuarioModal.tsx`** — estado `commissionPct: '' as string` no `formData`; preencher de `usuario.commission_pct` no `useEffect`; no `onSave`, incluir `commission_pct: formData.userType === 'comercial' && formData.commissionPct !== '' ? Number(formData.commissionPct) : null`. UI, logo abaixo do `<p className="text-xs text-muted-foreground">` dos tipos:

```tsx
          {formData.userType === 'comercial' && (
            <div className="space-y-2">
              <Label htmlFor="commission">Comissão (%)</Label>
              <Input id="commission" type="number" min={0} max={100} step={0.5} value={formData.commissionPct}
                onChange={(e) => setFormData((p) => ({ ...p, commissionPct: e.target.value }))} placeholder="ex.: 3" />
              <p className="text-xs text-muted-foreground">Aplicada sobre o valor de cada pedido recuperado por este comercial. Fica gravada no pedido — mudar aqui não altera o histórico.</p>
            </div>
          )}
```

- [ ] **Step 4: `UsuariosConfig.tsx`** — onde mapeia `usuario.user_type === 'comercial'` (l.~58–94), propagar `commission_pct: usuario.commission_pct ?? null` pro objeto usado pelo modal; na lista, ao lado do chip de tipo, mostrar `{u.user_type === 'comercial' && u.commission_pct != null && <span className="text-[11px] text-muted-foreground">{u.commission_pct}%</span>}`.

- [ ] **Step 5: Build** — `npx vite build 2>&1 | tail -2`.

- [ ] **Step 6: Commit**

```bash
git add src/types/usuarios.ts src/hooks/useUsersNew.ts src/components/modals/EditarUsuarioModal.tsx src/components/config/UsuariosConfig.tsx
git commit -m "feat(usuarios): comissão (%) do comercial no cadastro"
```

---

### Task 13 (controlador): aplicar, deployar, QA, advisor

- [ ] **Step 1: Revisão final do branch + baseline** — `npm test`, `deno test --allow-env supabase/functions/_shared/`, `deno check` em `commercial-coupon-create`, `yampi-process-event`, `whatsapp-outbound`, `yampi-connect` (comparar `ai-agent-execute` com a base), `npx vite build`.

- [ ] **Step 2: Aplicar a migration** (Management API) — dry-run da Task 1 já passou; agora o arquivo inteiro com `COMMIT`. Depois: `select name, order_index from leads_stages where leads_pipelines_id = '99269957-2359-4961-82e0-4099c3b033b7' order by 2` → 8 stages com "Em negociação" em 3. `select count(*) from leads where sku_id is not null` > 0.

- [ ] **Step 3: Deploy das functions**

```bash
for f in commercial-coupon-create yampi-process-event whatsapp-outbound yampi-connect ai-agent-execute; do
  supabase functions deploy $f --project-ref maigkwlgzinykfvemexf --no-verify-jwt=false; done
```

(`commercial-coupon-create` exige JWT — deploy padrão com verify.)

- [ ] **Step 4: Pentest de RLS com usuário comercial real** — criar `comercial-teste@growthsales.ai` (admin API + settings_users `user_type='comercial'`), logar, e via REST confirmar: `leads` devolve só pool/dele (hoje: 0 linhas, pool vazio até ~18/09 — então criar 1 lead de teste no Loja com `created_at = now()-16d` via service_role e confirmar que aparece; depois `rpc/claim_lead` → `ok:true`; `omni_channel_configs` → `[]`; `settings_users` → 1 linha). Remover o lead de teste. Manter o usuário de teste desativado (`active=false`) ou apagar.

- [ ] **Step 5: Admin continua vendo tudo** — JWT de `hyago@growthsales.ai`: `leads`, `clients_people`, `esteira_reconversions`, `leads_pipelines` (2 pipelines) como antes.

- [ ] **Step 6: Advisor** — `GET /v1/projects/maigkwlgzinykfvemexf/advisors/security` → 0 `ERROR`.

- [ ] **Step 7: Template Meta** — admin clica "Criar templates na Meta" (Integrações → Yampi → Prontidão) → `minimal_esteira_comercial_cupom: pending`. Anotar pra cliente acompanhar a aprovação.

- [ ] **Step 8: Merge** — `feat/comercial` contém a rodada 3. Merge na `main` só com ok explícito da cliente (é a release da rodada 3 + comercial). Push → Vercel.

---

## Self-review (feito ao escrever)

- **Cobertura da spec:** §2.1 colunas/stage/funções/RPC/RLS → T1; §2.2 nudge → T6; §3.1–3.2 cupom → T2–T3; §3.3 atribuição → T4; §4.2 kanban → T7–T8; §4.3 detalhe/prévia → T9; §4.4 sku_id → T1 (backfill) + T4 (gravação) + T8 (hook); §4.5 conversas → T9 (draft) + T5 (server); §4.6 BI → T10–T11; §4.7 usuários → T12; §4.8 entrada → T11; §5.1 template → T6; §5.2 handoff → T5; §6 testes → cada task + T13; §7 rollout → T13.
- **Placeholders:** nenhum `TBD`; os pontos "conferir X" são verificações de nomes existentes com o comando de grep indicado.
- **Consistência de nomes:** `claim_lead(p_lead_id)`, `recovered_by/recovery_basis/commission_pct/commission_value`, `leads.sku_id/claimed_at`, `crm_coupons.created_by/lead_id/percent/expires_at`, `useSkuImages(skuIds: number[])`, `KanbanColumn{ id,nome,cor,stageIds }`, `scope: 'admin'|'comercial'`, `COMMERCIAL_PERCENTS`/`COUPON_PERCENTS_COMMERCIAL` (front/back) — iguais em todas as tasks onde aparecem.
