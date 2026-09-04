# Esteira rodada 3 (timeline · A/B · WA com foto · produto no agente · E2 · editor de e-mail) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A operação configura a esteira numa linha do tempo (criar, mover, ligar/desligar toques por canal, com `vars` do WhatsApp na UI), roda um teste A/B de esteira completa com atribuição determinística e comparação no BI, manda templates WhatsApp com a foto do produto, o agente conhece o produto do carrinho, o E2 ganha título novo e o editor de e-mail vira editor de código com preview desktop/mobile, dados de lead real, imagens e envio de teste — sem tocar em nenhuma trava de envio.

**Architecture:** Três tabelas novas de A/B (`esteira_ab_experiments`, `esteira_ab_variants`, `esteira_ab_assignments`) + coluna `ab_variant_id` em regras/fila/links/reconversões; uma função SQL `assign_esteira_variant` chamada pelos dois enfileiradores (`followup-enqueue`, `enqueue_stage_followups`); o worker só propaga. Header de imagem entra na criação do template (`whatsapp-templates-manage` + Resumable Upload) e no envio (`buildEsteiraWaComponents` puro no worker). Produto do carrinho vem de `getProduct` + `summarizeProduct` puro + cache 24 h. Front: lógica pura em `src/lib/followups/*`, `src/lib/bi/abTest.ts`, `src/lib/emailTemplatePreview.ts`; hooks finos; componentes novos `EsteiraTimelineTab`, `AbExperimentPanel`, `AssetPicker`, `HtmlCodeEditor`, `AbTestCard`.

**Tech Stack:** Supabase Postgres (plpgsql, RLS) · Edge Functions Deno 2 (`deno test`) · React 18 + TS + Tailwind/shadcn · TanStack Query v5 · date-fns 3 · Vitest · `@uiw/react-codemirror` + `@codemirror/lang-html` (npm).

**Spec:** `docs/superpowers/specs/2026-09-05-esteira-rodada-3.md`

## Global Constraints

- Raio: `rounded-xl` (12 px) em cards e tooltips; chips `rounded-full`. Nunca `rounded-[4px]`/`borderRadius: 4`.
- Tipografia: textos de UI `text-[12px]`–`text-[13px]`; rótulos `text-[11px] uppercase tracking-wide text-muted-foreground`; números grandes `font-semibold tabular-nums`. Nunca fonte serifada.
- Cores só por token (`bg-card`, `border-border`, `text-muted-foreground`, `text-primary`, `--chart-*`); cores literais apenas nas tonalidades semânticas já usadas (emerald/amber/red/sky/violet em 400–500). Variantes A/B: A = `sky`, B = `violet`, C = `amber`, comum = neutro.
- Idioma da UI: português do Brasil, **sem emojis em rótulos** (emojis só em textos de e-mail/WhatsApp).
- Verificação de tipos: o repo **não** passa `tsc` no baseline. Regra: `npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep -E "<arquivos tocados>"` deve retornar **apenas** erros que já existiam (checar com `git stash` → rodar → `git stash pop`). `npx eslint <arquivo>` sem erros novos. `npm run build` passa.
- Nenhuma query por card/marcador: hooks recebem listas e fazem uma chamada com `.in(...)`.
- Commits pequenos, mensagem em português, trailer `Co-Authored-By: <modelo que implementou, ex.: Claude Sonnet 5> <noreply@anthropic.com>`. Antes de `git push`: `git pull -q --rebase origin main`.
- Sempre `cd /Volumes/nvme/minimal/Minimal-Cases-RevOS` antes de comandos (o cwd não persiste entre chamadas).
- **Não tocar em nenhuma trava de envio.** Proibido editar `_shared/whatsapp-send-lock.ts`, o bloco "TRAVA DE ENVIO"/allowlist de `whatsapp-outbound`, `isKlaviyoSendLocked`/`KLAVIYO_LOCKED_MSG` em `_shared/klaviyo-client.ts`, o gate `agent_requires_outreach` de `ai-agent-execute`; proibido ler/gravar `sends_locked`/`test_allowlist`. Todo envio novo entra pelos caminhos existentes (`whatsapp-outbound`, `sendEmailWithConfig`).
- Migrations em `supabase/migrations/` com nome `20260905HHMMSS_<slug>.sql`, **idempotentes** (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP POLICY IF EXISTS` antes de `CREATE POLICY`, `DO $$ … $$` para checks/constraints). Nunca `DROP TABLE`/`DROP COLUMN`. **Aplicar só na Task 16, via Management API (`POST /v1/projects/{ref}/database/query`) — NUNCA `supabase db push`** (histórico remoto dessincronizado).
- `docs/` está no `.gitignore`: commitar docs com `git add -f docs/superpowers/...`.
- Toda função pura nova em `supabase/functions/_shared/**` tem `*.test.ts` ao lado (`deno test --allow-env --allow-net supabase/functions/_shared/<arquivo>.test.ts`). Toda função pura nova em `src/lib/**` tem `*.test.ts` com Vitest (`npm test`).
- Deploy **só** das funções tocadas: `followup-enqueue`, `followup-trigger-worker`, `ai-agent-execute`, `yampi-process-event`, `whatsapp-templates-manage`, `email-template-test-send`.
- Tabelas novas não estão em `src/integrations/supabase/types.ts`: use `const db = supabase as unknown as SupabaseClient` como os hooks existentes (`useReconversaoBI`). Não regenerar types.
- Dependência nova só por npm (`@uiw/react-codemirror`, `@codemirror/lang-html`, `@codemirror/view`); nada de CDN. `HtmlCodeEditor` via `React.lazy`.

---

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| Create `supabase/migrations/20260905100000_esteira_ab_testing.sql` | Tabelas/colunas de A/B, `assign_esteira_variant`, `promote_ab_winner`, `finish_ab_experiment`, `enqueue_stage_followups` v2, RLS |
| Create `supabase/migrations/20260905101000_wa_header_image.sql` | `settings_whatsapp_channels.app_id`; comentário das chaves de `vars` |
| Create `supabase/migrations/20260905102000_yampi_products_cache.sql` | Cache do produto; regra PRODUTO + tool `consultar_produto` no agente |
| Create `supabase/migrations/20260905103000_email_template_versions.sql` | Versões de template de e-mail + trigger |
| Create `supabase/migrations/20260905104000_e2_titulo.sql` | Renomeia o E2 (opção A; B/C comentadas) |
| Create `supabase/functions/_shared/ab-rules.ts` (+ `.test.ts`) · Modify `supabase/functions/followup-enqueue/index.ts` | `filterRulesForVariant`; atribuição + filtro + `ab_variant_id` na fila |
| Modify `supabase/functions/_shared/wa-template-render.ts` · Create `wa-template-render.test.ts` | `templateHeaderKind`, `bodyPlaceholders`, `buttonHasDynamicUrl`, `resolveHeaderImage`, `buildEsteiraWaComponents` |
| Create `supabase/functions/_shared/meta-media-upload.ts` (+ `.test.ts`) · Modify `supabase/functions/whatsapp-templates-manage/index.ts` | Resumable Upload → `header_handle`; `create` com `header_image_url` |
| Create `supabase/functions/_shared/yampi-product.ts` (+ `.test.ts`) · Modify `supabase/functions/_shared/yampi-client.ts`, `supabase/functions/_shared/tracked-links.ts` | `summarizeProduct`, `describeProductForAgent`, `resolveProductSummary`; `getProduct`; `PersonCart.productId`; `CreateTrackedLinkOpts.abVariantId` |
| Modify `supabase/functions/followup-trigger-worker/index.ts` | Header de imagem + `buildEsteiraWaComponents` + `abVariantId` nos links |
| Modify `supabase/functions/ai-agent-execute/index.ts` | Bloco "Produto do carrinho" no contexto + tool `consultar_produto` |
| Modify `supabase/functions/yampi-process-event/index.ts` | `ab_experiment_id/ab_variant_id` na reconversão |
| Create `supabase/functions/email-template-test-send/index.ts` | Envio de teste com allowlist própria via `sendEmailWithConfig` |
| Create `src/lib/followups/timeline.ts`, `ab.ts`, `waRuleVars.ts` (+ testes) | Lógica pura da Timeline, split A/B, `vars` da regra |
| Create `src/lib/bi/abTest.ts` (+ teste) · Modify `src/lib/emailTemplatePreview.ts` (+ teste) | Agregação A/B + z de duas proporções; preview com largura e vars de lead real |
| Modify `src/hooks/useFollowups.ts` · Create `src/hooks/useAbExperiments.ts`, `src/hooks/useEmailTemplateVersions.ts`, `src/hooks/useEmailAssets.ts` · Create `src/components/config/AssetPicker.tsx` · Modify `package.json` | `vars`/`ab_variant_id`/PATCH parcial; CRUD de experimentos; versões; assets do bucket; seletor de imagem; deps CodeMirror |
| Modify `src/components/followups/FollowupModal.tsx` | Parâmetros WA, header de imagem, variáveis da regra, variante A/B, offset inicial, editor de código no e-mail manual |
| Create `src/components/followups/EsteiraTimelineTab.tsx`, `StageTimelineCard.tsx`, `TimelineMarker.tsx`, `AbExperimentPanel.tsx` · Modify `src/pages/Followups.tsx` | Aba "Timeline" |
| Modify `src/components/config/WhatsappTemplateBuilderModal.tsx`, `WhatsappTemplateDetails.tsx`, `WhatsappTemplatePreview.tsx` | Header "Imagem" no builder + render |
| Create `src/components/dashboard/reconversao/AbTestCard.tsx` · Create `src/hooks/useAbTestBI.ts` · Modify `src/components/dashboard/BIProReconversaoTab.tsx`, `src/hooks/useEsteiraLead.ts`, `src/components/negocios/NegocioEsteira.tsx` | Card A/B no BI; chip da variante no lead |
| Create `src/components/ui/html-code-editor.tsx` · Modify `src/components/config/EmailTemplateEditorModal.tsx` | Editor CodeMirror, preview desktop/mobile, lead real, inserir imagem, enviar teste, histórico |

**Ordem e paralelismo**

```
Task 0 (5 migrations, só escrever) — um executor
  ├─ Grupo A (paralelo): Task 1 · Task 2 · Task 3 · Task 4 · Task 8 · Task 9a · Task 9b · Task 10
  ├─ Grupo B (paralelo, após A): Task 5 (2,4) · Task 6 (4) · Task 7 (0) · Task 11 (9a,10) · Task 13 (3,10) · Task 14 (9b,10) · Task 15 (8,9b,10)
  ├─ Grupo C (após B): Task 12 (9a,10,11)
  └─ Task 16 (migrations via Management API + deploy + QA + push) — por último, controlador
```

---

### Task 0: Migrations (só escrever — aplicar na Task 16)

**Files:** Create os 5 arquivos abaixo. Um executor.

- [ ] **Step 1: `20260905100000_esteira_ab_testing.sql`**

```sql
-- ESTEIRA-AB — Teste A/B de esteira completa.
-- experimento por pipeline · variantes com peso · regra comum (ab_variant_id NULL) ou por variante
-- · atribuição determinística por pessoa (assign_esteira_variant) · fila/links/reconversões carregam a variante.
BEGIN;

CREATE TABLE IF NOT EXISTS public.esteira_ab_experiments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id       uuid NOT NULL REFERENCES public.leads_pipelines(id) ON DELETE CASCADE,
  name              text NOT NULL,
  hypothesis        text,
  status            text NOT NULL DEFAULT 'draft',
  started_at        timestamptz,
  paused_at         timestamptz,
  finished_at       timestamptz,
  winner_variant_id uuid,
  created_by        uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'esteira_ab_experiments_status_check') THEN
    ALTER TABLE public.esteira_ab_experiments ADD CONSTRAINT esteira_ab_experiments_status_check
      CHECK (status IN ('draft','running','paused','finished'));
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS esteira_ab_one_live_per_pipeline
  ON public.esteira_ab_experiments (pipeline_id) WHERE status IN ('running','paused');
COMMENT ON TABLE public.esteira_ab_experiments IS 'Teste A/B da esteira: um experimento running|paused por pipeline. Regras com ab_variant_id NULL são comuns a todas as variantes.';

CREATE TABLE IF NOT EXISTS public.esteira_ab_variants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id uuid NOT NULL REFERENCES public.esteira_ab_experiments(id) ON DELETE CASCADE,
  key           text NOT NULL,
  name          text NOT NULL,
  weight        integer NOT NULL DEFAULT 50,
  is_control    boolean NOT NULL DEFAULT false,
  position      integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (experiment_id, key)
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'esteira_ab_variants_key_check') THEN
    ALTER TABLE public.esteira_ab_variants ADD CONSTRAINT esteira_ab_variants_key_check CHECK (key ~ '^[A-Z]$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'esteira_ab_variants_weight_check') THEN
    ALTER TABLE public.esteira_ab_variants ADD CONSTRAINT esteira_ab_variants_weight_check CHECK (weight BETWEEN 0 AND 100);
  END IF;
END $$;

ALTER TABLE public.leads_stages_followups
  ADD COLUMN IF NOT EXISTS ab_variant_id uuid REFERENCES public.esteira_ab_variants(id) ON DELETE SET NULL;
COMMENT ON COLUMN public.leads_stages_followups.ab_variant_id IS 'NULL = regra comum (dispara pra todo mundo). Preenchido = só dispara pra leads atribuídos a esta variante.';
CREATE INDEX IF NOT EXISTS leads_stages_followups_ab_idx ON public.leads_stages_followups (ab_variant_id) WHERE ab_variant_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.esteira_ab_assignments (
  lead_id       uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  experiment_id uuid NOT NULL REFERENCES public.esteira_ab_experiments(id) ON DELETE CASCADE,
  variant_id    uuid NOT NULL REFERENCES public.esteira_ab_variants(id) ON DELETE CASCADE,
  people_id     uuid,
  bucket        integer NOT NULL,
  assigned_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lead_id, experiment_id)
);
CREATE INDEX IF NOT EXISTS esteira_ab_assignments_exp_var_idx ON public.esteira_ab_assignments (experiment_id, variant_id);
CREATE INDEX IF NOT EXISTS esteira_ab_assignments_people_idx  ON public.esteira_ab_assignments (people_id) WHERE people_id IS NOT NULL;

ALTER TABLE public.followup_queue        ADD COLUMN IF NOT EXISTS ab_variant_id uuid;
ALTER TABLE public.tracked_links         ADD COLUMN IF NOT EXISTS ab_variant_id uuid;
ALTER TABLE public.esteira_reconversions ADD COLUMN IF NOT EXISTS ab_experiment_id uuid, ADD COLUMN IF NOT EXISTS ab_variant_id uuid;
CREATE INDEX IF NOT EXISTS followup_queue_ab_idx        ON public.followup_queue (ab_variant_id) WHERE ab_variant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS tracked_links_ab_idx         ON public.tracked_links (ab_variant_id) WHERE ab_variant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS esteira_reconversions_ab_idx ON public.esteira_reconversions (ab_experiment_id) WHERE ab_experiment_id IS NOT NULL;

-- ── Atribuição determinística (única fonte da verdade; chamada pelos dois enfileiradores) ──
CREATE OR REPLACE FUNCTION public.assign_esteira_variant(p_lead_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_pipeline uuid; v_people uuid; v_exp uuid; v_existing uuid; v_bucket int; v_acc int := 0; v_variant uuid; r record;
BEGIN
  SELECT leads_pipelines_id, people_id INTO v_pipeline, v_people FROM public.leads WHERE id = p_lead_id;
  IF v_pipeline IS NULL THEN RETURN NULL; END IF;
  SELECT id INTO v_exp FROM public.esteira_ab_experiments WHERE pipeline_id = v_pipeline AND status = 'running' LIMIT 1;
  IF v_exp IS NULL THEN RETURN NULL; END IF;

  SELECT variant_id INTO v_existing FROM public.esteira_ab_assignments WHERE lead_id = p_lead_id AND experiment_id = v_exp;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  -- mesma pessoa no mesmo experimento → mesma variante
  IF v_people IS NOT NULL THEN
    SELECT variant_id INTO v_existing FROM public.esteira_ab_assignments
     WHERE people_id = v_people AND experiment_id = v_exp ORDER BY assigned_at LIMIT 1;
  END IF;

  v_bucket := (('x' || substr(md5(v_exp::text || ':' || coalesce(v_people::text, p_lead_id::text)), 1, 6))::bit(24)::int) % 10000;

  IF v_existing IS NOT NULL THEN
    v_variant := v_existing;
  ELSE
    FOR r IN SELECT id, weight FROM public.esteira_ab_variants WHERE experiment_id = v_exp ORDER BY position, key LOOP
      v_acc := v_acc + r.weight * 100;
      IF v_bucket < v_acc THEN v_variant := r.id; EXIT; END IF;
    END LOOP;
    IF v_variant IS NULL THEN
      SELECT id INTO v_variant FROM public.esteira_ab_variants WHERE experiment_id = v_exp ORDER BY position, key LIMIT 1;
    END IF;
  END IF;
  IF v_variant IS NULL THEN RETURN NULL; END IF;

  INSERT INTO public.esteira_ab_assignments (lead_id, experiment_id, variant_id, people_id, bucket)
  VALUES (p_lead_id, v_exp, v_variant, v_people, v_bucket)
  ON CONFLICT (lead_id, experiment_id) DO NOTHING;
  RETURN v_variant;
END $fn$;
REVOKE ALL ON FUNCTION public.assign_esteira_variant(uuid) FROM PUBLIC, anon, authenticated;

-- ── Encerramento ──
CREATE OR REPLACE FUNCTION public.promote_ab_winner(p_experiment_id uuid, p_winner uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.esteira_ab_variants WHERE id = p_winner AND experiment_id = p_experiment_id) THEN
    RAISE EXCEPTION 'variante % não pertence ao experimento %', p_winner, p_experiment_id;
  END IF;
  UPDATE public.leads_stages_followups SET ab_variant_id = NULL, updated_at = now() WHERE ab_variant_id = p_winner;
  UPDATE public.leads_stages_followups SET active = false, updated_at = now()
   WHERE ab_variant_id IN (SELECT id FROM public.esteira_ab_variants WHERE experiment_id = p_experiment_id AND id <> p_winner);
  UPDATE public.esteira_ab_experiments SET status = 'finished', winner_variant_id = p_winner, finished_at = now(), updated_at = now()
   WHERE id = p_experiment_id;
END $fn$;

CREATE OR REPLACE FUNCTION public.finish_ab_experiment(p_experiment_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  UPDATE public.leads_stages_followups SET active = false, updated_at = now()
   WHERE ab_variant_id IN (SELECT id FROM public.esteira_ab_variants WHERE experiment_id = p_experiment_id);
  UPDATE public.esteira_ab_experiments SET status = 'finished', finished_at = now(), updated_at = now() WHERE id = p_experiment_id;
END $fn$;
-- managers podem chamar as duas (RLS das tabelas não se aplica dentro de SECURITY DEFINER; a checagem de papel é aqui)
REVOKE ALL ON FUNCTION public.promote_ab_winner(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finish_ab_experiment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.promote_ab_winner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finish_ab_experiment(uuid) TO authenticated;

-- ── Backfill em massa honra a variante ──
CREATE OR REPLACE FUNCTION public.enqueue_stage_followups(p_stage_id uuid, p_dry_run boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_leads int := 0; v_pairs int := 0; v_inserted int := 0;
BEGIN
  CREATE TEMP TABLE _esteira_cand ON COMMIT DROP AS
  WITH lv AS (
    SELECT l.id AS lead_id, l.people_id, l.control, public.assign_esteira_variant(l.id) AS variant_id
    FROM public.leads l
    WHERE l.leads_stages_id = p_stage_id AND l.status = 'in_progress' AND coalesce(l.control, '') <> 'sem_fup'
  )
  SELECT lv.lead_id, lv.people_id, f.id AS followup_id, f.type AS channel, f.template_id, f.message, f.subject, lv.variant_id,
         now() + make_interval(days => coalesce(f.days,0), hours => coalesce(f.hours,0), mins => coalesce(f.minutes,0)) AS scheduled_for
  FROM lv
  JOIN public.leads_stages_followups f ON f.leads_stages_id = p_stage_id AND f.active = true
  LEFT JOIN public.clients_people p ON p.id = lv.people_id
  WHERE (f.control IS NULL OR f.control = lv.control)
    AND (f.score_matrix_id IS NULL OR f.score_matrix_id = p.score_matrix_id)
    AND (f.ab_variant_id IS NULL OR f.ab_variant_id = lv.variant_id)
    AND NOT EXISTS (SELECT 1 FROM public.followup_queue q WHERE q.lead_id = lv.lead_id AND q.followup_id = f.id AND q.status <> 'cancelled');

  SELECT count(DISTINCT lead_id), count(*) INTO v_leads, v_pairs FROM _esteira_cand;
  IF NOT p_dry_run THEN
    INSERT INTO public.followup_queue (followup_id, lead_id, person_id, channel, template_id, message, subject, source_type, scheduled_for, status, ab_variant_id)
    SELECT followup_id, lead_id, people_id, channel, template_id, message, subject, 'stage', scheduled_for, 'pending', variant_id FROM _esteira_cand;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
  END IF;
  RETURN jsonb_build_object('leads', v_leads, 'entries', v_pairs, 'inserted', v_inserted, 'dry_run', p_dry_run);
END $fn$;
REVOKE ALL ON FUNCTION public.enqueue_stage_followups(uuid, boolean) FROM PUBLIC, anon, authenticated;

-- ── RLS ──
ALTER TABLE public.esteira_ab_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.esteira_ab_variants    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.esteira_ab_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ab_exp_select ON public.esteira_ab_experiments;
CREATE POLICY ab_exp_select ON public.esteira_ab_experiments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.settings_users su WHERE su.auth_user_id = auth.uid() AND su.active = true AND su.deleted_at IS NULL));
DROP POLICY IF EXISTS ab_exp_write ON public.esteira_ab_experiments;
CREATE POLICY ab_exp_write ON public.esteira_ab_experiments FOR ALL USING (
  EXISTS (SELECT 1 FROM public.settings_users su WHERE su.auth_user_id = auth.uid() AND su.active = true AND su.deleted_at IS NULL
          AND (su.super_admin = true OR su.user_type = 'manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.settings_users su WHERE su.auth_user_id = auth.uid() AND su.active = true AND su.deleted_at IS NULL
          AND (su.super_admin = true OR su.user_type = 'manager')));
DROP POLICY IF EXISTS ab_exp_service ON public.esteira_ab_experiments;
CREATE POLICY ab_exp_service ON public.esteira_ab_experiments FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS ab_var_select ON public.esteira_ab_variants;
CREATE POLICY ab_var_select ON public.esteira_ab_variants FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.settings_users su WHERE su.auth_user_id = auth.uid() AND su.active = true AND su.deleted_at IS NULL));
DROP POLICY IF EXISTS ab_var_write ON public.esteira_ab_variants;
CREATE POLICY ab_var_write ON public.esteira_ab_variants FOR ALL USING (
  EXISTS (SELECT 1 FROM public.settings_users su WHERE su.auth_user_id = auth.uid() AND su.active = true AND su.deleted_at IS NULL
          AND (su.super_admin = true OR su.user_type = 'manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.settings_users su WHERE su.auth_user_id = auth.uid() AND su.active = true AND su.deleted_at IS NULL
          AND (su.super_admin = true OR su.user_type = 'manager')));
DROP POLICY IF EXISTS ab_var_service ON public.esteira_ab_variants;
CREATE POLICY ab_var_service ON public.esteira_ab_variants FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS ab_asg_select ON public.esteira_ab_assignments;
CREATE POLICY ab_asg_select ON public.esteira_ab_assignments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.settings_users su WHERE su.auth_user_id = auth.uid() AND su.active = true AND su.deleted_at IS NULL));
DROP POLICY IF EXISTS ab_asg_service ON public.esteira_ab_assignments;
CREATE POLICY ab_asg_service ON public.esteira_ab_assignments FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

COMMIT;
```

- [ ] **Step 2: `20260905101000_wa_header_image.sql`**

```sql
-- WA-IMG — templates WhatsApp com header de imagem.
BEGIN;
ALTER TABLE public.settings_whatsapp_channels ADD COLUMN IF NOT EXISTS app_id text;
COMMENT ON COLUMN public.settings_whatsapp_channels.app_id IS 'Meta App ID do app dono do access_token — exigido pela Resumable Upload API (header de imagem em templates). Fallback: secret META_APP_ID.';
COMMENT ON COLUMN public.leads_stages_followups.vars IS
  'Vars estáticas da regra. E-mail/SMS: cupom, cupom_pct, expira_horas. WhatsApp: wa_params (array de nomes de var por {{n}} do corpo: nome|remetente|produto|modelo_celular|preco|cupom|expira_em), wa_button_url (bool: botão URL com token do link rastreado), wa_header_mode (sku|fixa), wa_header_image (URL pública, modo fixa/fallback).';
COMMIT;
```

- [ ] **Step 3: `20260905102000_yampi_products_cache.sql`**

```sql
-- AGENTE-PRODUTO — o agente conhece o produto do carrinho.
BEGIN;
CREATE TABLE IF NOT EXISTS public.yampi_products_cache (
  product_id bigint PRIMARY KEY,
  summary    jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.yampi_products_cache IS 'Resumo do produto (GET /catalog/products/{id}?include=texts,brand,categories,skus,images) pro agente. TTL 24h em resolveProductSummary().';
ALTER TABLE public.yampi_products_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS yampi_products_cache_service_role ON public.yampi_products_cache;
CREATE POLICY yampi_products_cache_service_role ON public.yampi_products_cache
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

UPDATE public.ai_agents
   SET general_rules = COALESCE(general_rules, '') || E'\n- PRODUTO: o CONTEXTO traz um bloco "Produto do carrinho" (material, cores e modelos disponíveis, faixa de preço, estoque). Use-o pra responder "é de couro?", "tem em preto?", "serve no 17 Pro?" antes de perguntar. Pra detalhe que não está lá (medidas, o que vem na caixa, garantia), chame consultar_produto. NUNCA invente especificação, cor ou modelo.',
       enabled_tools = CASE WHEN 'consultar_produto' = ANY (COALESCE(enabled_tools, '{}')) THEN enabled_tools ELSE array_append(COALESCE(enabled_tools, '{}'), 'consultar_produto') END,
       updated_at = now()
 WHERE name = 'Minimal · Recuperação WhatsApp'
   AND COALESCE(general_rules, '') NOT LIKE '%PRODUTO:%';
COMMIT;
```

- [ ] **Step 4: `20260905103000_email_template_versions.sql`**

```sql
-- EMAIL-VERSIONS — histórico de versões dos templates de e-mail (snapshot do estado anterior a cada UPDATE de conteúdo).
BEGIN;
CREATE TABLE IF NOT EXISTS public.email_template_versions (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  template_id uuid NOT NULL REFERENCES public.email_templates(id) ON DELETE CASCADE,
  name        text,
  subject     text NOT NULL,
  html_body   text NOT NULL,
  variables   text[] NOT NULL DEFAULT '{}',
  saved_by    uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_template_versions_tpl_idx ON public.email_template_versions (template_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.email_templates_snapshot_version()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF OLD.html_body IS DISTINCT FROM NEW.html_body OR OLD.subject IS DISTINCT FROM NEW.subject OR OLD.name IS DISTINCT FROM NEW.name THEN
    INSERT INTO public.email_template_versions (template_id, name, subject, html_body, variables, saved_by)
    VALUES (OLD.id, OLD.name, OLD.subject, OLD.html_body, COALESCE(OLD.variables, '{}'), auth.uid());
    DELETE FROM public.email_template_versions
     WHERE template_id = OLD.id AND id NOT IN (
       SELECT id FROM public.email_template_versions WHERE template_id = OLD.id ORDER BY created_at DESC, id DESC LIMIT 30);
  END IF;
  RETURN NEW;
END $fn$;
DROP TRIGGER IF EXISTS email_templates_snapshot_version ON public.email_templates;
CREATE TRIGGER email_templates_snapshot_version
  BEFORE UPDATE OF name, subject, html_body ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.email_templates_snapshot_version();

ALTER TABLE public.email_template_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS etv_select ON public.email_template_versions;
CREATE POLICY etv_select ON public.email_template_versions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.settings_users su WHERE su.auth_user_id = auth.uid() AND su.active = true AND su.deleted_at IS NULL));
DROP POLICY IF EXISTS etv_delete_managers ON public.email_template_versions;
CREATE POLICY etv_delete_managers ON public.email_template_versions FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.settings_users su WHERE su.auth_user_id = auth.uid() AND su.active = true AND su.deleted_at IS NULL
          AND (su.super_admin = true OR su.user_type = 'manager')));
DROP POLICY IF EXISTS etv_service ON public.email_template_versions;
CREATE POLICY etv_service ON public.email_template_versions FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
COMMIT;
```

- [ ] **Step 5: `20260905104000_e2_titulo.sql`** (opção **A**; a cliente escolhe — spec §8.4)

```sql
-- E2-TITULO — "Celular voando na praia. E a gente rindo." → opção A. Idempotente: só roda enquanto o subject antigo existir.
-- Opção B: subject '{{nome}}, para de segurar o celular com medo.' · h1 'Para de segurar o celular com medo. <span style="color:#9b9b9b;">Ele está protegido.</span>' · name 'Esteira · E2 — Sem medo'
-- Opção C: subject '2 metros de queda. Zero drama, {{nome}}.' · h1 '2 metros de queda. <span style="color:#9b9b9b;">Zero drama.</span>' · name 'Esteira · E2 — 2 metros de queda'
BEGIN;
UPDATE public.email_templates
   SET name = 'Esteira · E2 — Pode derrubar',
       subject = 'Pode derrubar, {{nome}}.',
       html_body = replace(replace(html_body,
         '<title>Celular voando na praia. E a gente rindo.</title>',
         '<title>Pode derrubar. A gente aguenta o tombo.</title>'),
         'Celular voando na praia. <span style="color:#9b9b9b;">E ninguém prendendo a respiração.</span>',
         'Pode derrubar. <span style="color:#9b9b9b;">A gente aguenta o tombo.</span>'),
       updated_at = now()
 WHERE id = '52e679cf-375e-4f6b-98d4-79311abe6702'
   AND subject = 'Celular voando na praia. E a gente rindo.';
COMMIT;
```

- [ ] **Step 6: Commit** — `git add supabase/migrations/20260905*.sql && git commit -m "feat(esteira): migrations da rodada 3 — A/B, header de imagem WA, cache de produto, versões de e-mail, título do E2 (não aplicadas)"`

---

### Task 1: `ab-rules.ts` + `followup-enqueue` honra a variante

**Files:** Create `supabase/functions/_shared/ab-rules.ts`, `ab-rules.test.ts` · Modify `supabase/functions/followup-enqueue/index.ts`

- [ ] **Step 1: Teste (falha)**

```ts
// supabase/functions/_shared/ab-rules.test.ts
// Run: deno test --allow-env supabase/functions/_shared/ab-rules.test.ts
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { filterRulesForVariant } from './ab-rules.ts';

const rules = [
  { id: 'c1', ab_variant_id: null },
  { id: 'a1', ab_variant_id: 'A' },
  { id: 'b1', ab_variant_id: 'B' },
  { id: 'c2' }, // legado sem coluna
];
Deno.test('sem experimento: só regras comuns', () => {
  assertEquals(filterRulesForVariant(rules, null).map((r) => r.id), ['c1', 'c2']);
});
Deno.test('lead em B: comuns + B', () => {
  assertEquals(filterRulesForVariant(rules, 'B').map((r) => r.id), ['c1', 'b1', 'c2']);
});
```

- [ ] **Step 2: Implementar**

```ts
// supabase/functions/_shared/ab-rules.ts
/** Regras elegíveis pra um lead dado a variante atribuída (null = sem experimento running). Comum (ab_variant_id NULL) sempre entra. */
export interface RuleLike { id: string; ab_variant_id?: string | null }
export function filterRulesForVariant<T extends RuleLike>(rules: T[], variantId: string | null): T[] {
  return rules.filter((r) => r.ab_variant_id == null || r.ab_variant_id === variantId);
}
```

- [ ] **Step 3: `followup-enqueue/index.ts`** — no modo STAGE, logo após o bloco `if ((lead as …).control === 'sem_fup')` e antes de buscar `followups`:

```ts
    // ESTEIRA-AB: atribui (ou recupera) a variante do lead — só há experimento running no pipeline dele. Nunca derruba o enqueue.
    let abVariantId: string | null = null;
    if (source_type === 'stage') {
      const { data: v, error: vErr } = await supabase.rpc('assign_esteira_variant', { p_lead_id: lead_id });
      if (vErr) console.warn('[followup-enqueue] assign_esteira_variant falhou:', vErr.message);
      abVariantId = (v as string | null) ?? null;
    }
```
Depois de `if (fupError) throw fupError;`: `const eligible = filterRulesForVariant(followups ?? [], abVariantId);` e trocar `for (const fup of followups)` por `for (const fup of eligible)`; a checagem de vazio passa a usar `eligible.length === 0` (mensagem "Nenhum follow-up ativo para esta etapa (variante)"). No `queueEntries.push` do modo STAGE acrescentar `ab_variant_id: abVariantId,`. Import: `import { filterRulesForVariant } from '../_shared/ab-rules.ts';`. Log: `console.log(`[followup-enqueue] variante A/B: ${abVariantId ?? 'nenhuma'}`)`.

- [ ] **Step 4: Verificar e commitar** — `deno test --allow-env supabase/functions/_shared/ab-rules.test.ts && deno check supabase/functions/followup-enqueue/index.ts`
`git commit -m "feat(ab): followup-enqueue atribui variante e filtra regras por variante"`

---

### Task 2: `wa-template-render.ts` — header de imagem e montagem dos components da esteira

**Files:** Modify `supabase/functions/_shared/wa-template-render.ts` · Create `supabase/functions/_shared/wa-template-render.test.ts`

**Interfaces (exportar):**
```ts
export type HeaderKind = 'none' | 'text' | 'image' | 'video' | 'document';
export interface TplComponent { type: string; format?: string; text?: string; buttons?: Array<{ type: string; text?: string; url?: string }> }
export function templateHeaderKind(components: TplComponent[]): HeaderKind
export function bodyPlaceholders(components: TplComponent[]): number[]            // {{n}} do BODY, ordem de aparição
export function buttonHasDynamicUrl(components: TplComponent[]): boolean          // BUTTONS[].type==='URL' && url contém {{1}}
export function resolveHeaderImage(ruleVars: Record<string, unknown>, cart: { imagemProduto: string | null } | null, fallback: string): string
export interface EsteiraWaBuild { templateComponents: TplComponent[]; waParams: string[]; waVars: Record<string, string>; ruleVars: Record<string, unknown>; buttonToken: string | null; headerImageUrl: string | null }
export function buildEsteiraWaComponents(input: EsteiraWaBuild): Array<Record<string, unknown>>
```

- [ ] **Step 1: Teste (falha)** — casos: (a) header TEXT com `{{nome}}` → `[{type:'header', parameters:[{type:'text', text:'', parameter_name:'nome'}]}]` como hoje; (b) header IMAGE → `{type:'header', parameters:[{type:'image', image:{link: headerImageUrl}}]}` **sempre primeiro**, mesmo sem `waParams`; (c) `waParams=['nome','produto']` → body com 2 textos na ordem (`waVars[k] ?? String(ruleVars[k] ?? '')`); (d) `buttonToken='abc'` → `{type:'button', sub_type:'url', index:'0', parameters:[{type:'text', text:'abc'}]}`; (e) sem header, sem params, sem token → `[]`. `resolveHeaderImage`: modo `sku` com foto → foto; `sku` sem foto e com `wa_header_image` → fixa; `sku` sem nada → fallback; `fixa` → `wa_header_image` ?? fallback; sem modo → igual a `sku`. `templateHeaderKind`: `[{type:'HEADER', format:'IMAGE'}]` → `'image'`; `[{type:'BODY'}]` → `'none'`; format ausente com text → `'text'`. `bodyPlaceholders([{type:'BODY', text:'Oi {{1}}, sua {{2}}'}])` → `[1,2]`. `buttonHasDynamicUrl` com `url:'https://x/r?t={{1}}'` → true.

- [ ] **Step 2: Implementar** (usa `extractPositionals` já existente no arquivo)

```ts
export function templateHeaderKind(components: TplComponent[]): HeaderKind {
  const h = components.find((c) => String(c.type).toUpperCase() === 'HEADER');
  if (!h) return 'none';
  const f = String(h.format ?? (h.text ? 'TEXT' : '')).toUpperCase();
  return f === 'IMAGE' ? 'image' : f === 'VIDEO' ? 'video' : f === 'DOCUMENT' ? 'document' : f === 'TEXT' ? 'text' : 'none';
}
export function bodyPlaceholders(components: TplComponent[]): number[] {
  const b = components.find((c) => String(c.type).toUpperCase() === 'BODY');
  return b?.text ? extractPositionals(b.text) : [];
}
export function buttonHasDynamicUrl(components: TplComponent[]): boolean {
  const bt = components.find((c) => String(c.type).toUpperCase() === 'BUTTONS');
  return !!bt?.buttons?.some((b) => String(b.type).toUpperCase() === 'URL' && /\{\{1\}\}/.test(b.url ?? ''));
}
export function resolveHeaderImage(ruleVars: Record<string, unknown>, cart: { imagemProduto: string | null } | null, fallback: string): string {
  const fixed = typeof ruleVars.wa_header_image === 'string' && /^https?:\/\//.test(ruleVars.wa_header_image) ? ruleVars.wa_header_image : null;
  const mode = ruleVars.wa_header_mode === 'fixa' ? 'fixa' : 'sku';
  if (mode === 'sku' && cart?.imagemProduto) return cart.imagemProduto;
  return fixed ?? fallback;
}
export function buildEsteiraWaComponents(i: EsteiraWaBuild): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  const kind = templateHeaderKind(i.templateComponents);
  if (kind === 'text') {
    const h = i.templateComponents.find((c) => String(c.type).toUpperCase() === 'HEADER');
    const name = h?.text?.match(/\{\{([^}]+)\}\}/)?.[1] ?? null;
    if (name) out.push({ type: 'header', parameters: [{ type: 'text', text: '', parameter_name: name }] });
  } else if (kind === 'image' && i.headerImageUrl) {
    out.push({ type: 'header', parameters: [{ type: 'image', image: { link: i.headerImageUrl } }] });
  }
  if (i.waParams.length > 0) {
    out.push({ type: 'body', parameters: i.waParams.map((k) => ({ type: 'text', text: i.waVars[k] ?? String(i.ruleVars[k] ?? '') })) });
  }
  if (i.buttonToken) out.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: i.buttonToken }] });
  return out;
}
```

- [ ] **Step 3: Verificar e commitar** — `deno test --allow-env supabase/functions/_shared/wa-template-render.test.ts` → verde.
`git commit -m "feat(wa): helpers puros de header de imagem e components da esteira"`

---

### Task 3: Upload de mídia da Meta + `whatsapp-templates-manage` cria template com header de imagem

**Files:** Create `supabase/functions/_shared/meta-media-upload.ts`, `meta-media-upload.test.ts` · Modify `supabase/functions/whatsapp-templates-manage/index.ts`

**Interfaces:**
```ts
export function guessImageMime(url: string, contentType?: string | null): 'image/jpeg' | 'image/png' | null
export interface UploadInput { appId: string; accessToken: string; imageUrl: string }
export interface UploadDeps { fetchImpl?: typeof fetch; graphVersion?: string; maxBytes?: number }
export async function uploadHeaderHandle(input: UploadInput, deps?: UploadDeps): Promise<{ handle: string; bytes: number; mime: string }>
```

- [ ] **Step 1: Teste (falha)** — `fetchImpl` fake com 3 respostas em sequência: (1) GET imagem → `new Response(new Uint8Array(10), { headers: { 'content-type': 'image/jpeg' } })`; (2) POST `/v23.0/APP/uploads?file_length=10&file_type=image%2Fjpeg` → `{ id: 'upload:XYZ' }` (assert na URL e no header `Authorization: OAuth TOKEN`); (3) POST `/v23.0/upload:XYZ` com header `file_offset: 0` e body de 10 bytes → `{ h: '2:abc' }`. Espera `{ handle: '2:abc', bytes: 10, mime: 'image/jpeg' }`. Casos de erro: content-type `image/gif` → throw "Formato não suportado (use JPEG ou PNG)"; bytes > `maxBytes` (5 MB) → throw; Meta 400 → throw com `error.message` da Meta. `guessImageMime('https://x/a.png')` → `image/png`; content-type prevalece sobre extensão.

- [ ] **Step 2: Implementar** — três `fetch`; `Authorization: OAuth ${accessToken}` nos dois POSTs (é o que a Resumable Upload API espera, não `Bearer`); `Content-Type: application/octet-stream` no segundo; erros com mensagem legível em pt-BR; sem logar token.

- [ ] **Step 3: `whatsapp-templates-manage/index.ts`**
  - `CreatePayload` ganha `header_image_url?: string`.
  - `getChannelCredentials` passa a `select('waba_id, access_token, app_id')` e devolve também `app_id: string | null` (cast; a coluna vem da Task 0).
  - Em `handleCreate`, antes do `metaPayload`: se `header_image_url`: validar `https://`; rejeitar se `components` já tiver `HEADER` ("Escolha header de texto OU imagem"); `const appId = app_id ?? Deno.env.get('META_APP_ID') ?? ''`; sem appId → `jsonResponse({ error: 'Informe o App ID da Meta no canal (Configurações → Canais → WhatsApp) para usar imagem no cabeçalho.' })`; `const { handle } = await uploadHeaderHandle({ appId, accessToken: access_token, imageUrl: header_image_url })` (erro → `jsonResponse({ error: e.message })`); `components = [{ type: 'HEADER', format: 'IMAGE', example: { header_handle: [handle] } }, ...components]`.
  - No `row.json_data` acrescentar `header_image_url: header_image_url ?? null` (a UI mostra a imagem; o handle não é URL).
  - Log `create_start` inclui `header_image: !!header_image_url`.

- [ ] **Step 4: Verificar e commitar** — `deno test --allow-env supabase/functions/_shared/meta-media-upload.test.ts && deno check supabase/functions/whatsapp-templates-manage/index.ts`
`git commit -m "feat(wa): criação de template com header de imagem via Resumable Upload"`

---

### Task 4: Produto da Yampi — `getProduct`, resumo puro, cache; `PersonCart.productId`; `abVariantId` nos links

**Files:** Create `supabase/functions/_shared/yampi-product.ts`, `yampi-product.test.ts` · Modify `supabase/functions/_shared/yampi-client.ts`, `supabase/functions/_shared/tracked-links.ts`

**Interfaces:**
```ts
// yampi-product.ts
export interface ProductSummary { id: number; nome: string; marca: string | null; descricao: string; categorias: string[]; cores: string[]; modelos: string[]; precoMin: number | null; precoMax: number | null; variantes: number; semEstoque: string[]; imagem: string | null; variantesDetalhe: Array<{ skuId: number; titulo: string; cor: string | null; modelo: string | null; preco: number | null; emEstoque: boolean }> }
export function stripHtml(html: string): string
export function truncateAtSentence(text: string, max: number): string
export function summarizeProduct(raw: unknown): ProductSummary | null
export function describeProductForAgent(s: ProductSummary): string
export async function resolveProductSummary(supabase: SupabaseClient, productId: number, opts?: { force?: boolean; ttlMs?: number }): Promise<ProductSummary | null>
// yampi-client.ts
async getProduct(productId: number | string): Promise<Json>   // GET /catalog/products/{id}?include=texts,brand,categories,skus,images → res.data ?? res
// tracked-links.ts
PersonCart.productId: number | null            // de sku.product_id (Yampi) — Zoppy fica null
CreateTrackedLinkOpts.abVariantId?: string | null   // gravado em tracked_links.ab_variant_id
```

- [ ] **Step 1: Teste (falha)** — fixture no formato Yampi (`{ data: { id: 1, name: 'Case Couro Porta Cartões', brand: { data: { name: 'Minimal' } }, texts: { data: { description: '<p>Couro <b>legítimo</b>…</p><img src=x>' } }, categories: { data: [{ name: 'Couro' }, { name: 'Modelos iPhone 17' }] }, images: { data: [{ medium: { url: 'https://cdn/x.jpg' } }] }, skus: { data: [{ id: 11, title: 'Case Couro Preto iPhone 17', price_sale: 149.9, price_discount: 142.9, total_in_stock: 3, variations: [{ name: 'Cor', value: 'Preto' }, { name: 'Modelo', value: 'iPhone 17' }] }, { id: 12, title: '…Marrom iPhone 17 Pro', price_sale: 149.9, total_in_stock: 0, variations: { data: [{ name: 'Cor', value: 'Marrom' }, { name: 'Modelo', value: 'iPhone 17 Pro' }] } }] } } }`). Espera: `cores` `['Preto','Marrom']`, `modelos` `['iPhone 17','iPhone 17 Pro']`, `precoMin 142.9`, `precoMax 149.9`, `variantes 2`, `semEstoque ['Marrom / iPhone 17 Pro']`, `descricao` sem tags e ≤ 600, `imagem 'https://cdn/x.jpg'`. Segundo fixture com arrays diretos (sem `.data`) dá o mesmo. `summarizeProduct(null)` → null. `describeProductForAgent` contém "Produto do carrinho: Case Couro Porta Cartões (Minimal)", "Cores disponíveis: Preto, Marrom", "Modelos: iPhone 17, iPhone 17 Pro", "Preço: R$ 142,90 a R$ 149,90", "Sem estoque: Marrom / iPhone 17 Pro". `truncateAtSentence('A b. C d. E', 8)` → `'A b.'`.

- [ ] **Step 2: Implementar** — helpers `rec()`/`list()` defensivos (aceitam `x.data` ou o valor direto); variação de cor = `name` casa `/cor|color/i`, modelo = `/modelo|aparelho|celular|compat/i`; `formatBRL` importado de `./tracked-links.ts`; `resolveProductSummary`: `select summary, fetched_at from yampi_products_cache where product_id` → se fresco (`ttlMs` default 24 h) e não `force` devolve; senão `createYampiClientForConnection` → `getProduct` → `summarizeProduct` → `upsert` (`onConflict: 'product_id'`); qualquer erro → devolve o cache velho se existir, senão null; nunca lança.

- [ ] **Step 3: `yampi-client.ts`** — adicionar `getProduct` ao lado de `getProductImages`. **`tracked-links.ts`:** `PersonCart.productId` (no `empty` e no retorno Yampi: `typeof sku.product_id === 'number' ? sku.product_id : null`; Zoppy `null`); `CreateTrackedLinkOpts.abVariantId?: string | null` e no insert de `createTrackedLinkDetailed` gravar `ab_variant_id: opts.abVariantId ?? null`.

- [ ] **Step 4: Verificar e commitar** — `deno test --allow-env --allow-net supabase/functions/_shared/yampi-product.test.ts supabase/functions/_shared/tracked-links-url.test.ts`
`git commit -m "feat(yampi): resumo do produto com cache, productId no carrinho, variante A/B nos links"`

---

### Task 5: `followup-trigger-worker` — header de imagem + components puros + variante nos links

**Files:** Modify `supabase/functions/followup-trigger-worker/index.ts` · Depende de: Task 2, Task 4.

- [ ] **Step 1: Imports** — `import { buildEsteiraWaComponents, resolveHeaderImage, templateHeaderKind, type TplComponent } from "../_shared/wa-template-render.ts";`

- [ ] **Step 2: Substituir o bloco inline** (de `type TplComponent = …` até o fim do `if (entry.followup_id) { … }` que monta `msgComponents`, ~l. 276–333) por:

```ts
          const tplComponents = (((tplRow?.json_data as Record<string, unknown>)?.components as TplComponent[]) ?? []);
          const headerKind = templateHeaderKind(tplComponents);
          let waLink: { id: string; token: string; url: string } | null = null;
          let msgComponents: Array<Record<string, unknown>> = [];
          {
            const { data: waRule } = entry.followup_id
              ? await supabase.from('leads_stages_followups').select('vars').eq('id', entry.followup_id).maybeSingle()
              : { data: null };
            const rv = ((waRule as { vars?: Record<string, unknown> } | null)?.vars ?? {}) as Record<string, unknown>;
            const waParams = Array.isArray(rv.wa_params) ? (rv.wa_params as string[]) : [];
            const needsCart = waParams.length > 0 || !!rv.wa_button_url || headerKind === 'image';
            const waCart = needsCart && entry.person_id ? await resolveCartForPerson(supabase, entry.person_id) : null;
            const eCredsWa = (emailConfig?.credentials ?? {}) as Record<string, string>;
            const expiraH = Number(rv.expira_horas ?? '24') || 24;
            const expiraWa = new Date(Date.now() + expiraH * 3_600_000)
              .toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' às');
            const waVars: Record<string, string> = {
              nome: (pessoa?.name ?? '').split(/\s+/)[0] || 'cliente',
              remetente: eCredsWa.sender_name || eCredsWa.from_name || 'Minimal Cases',
              produto: waCart?.produto ?? 'sua case Minimal',
              modelo_celular: waCart?.modeloCelular ?? 'seu celular',
              preco: formatBRL(waCart?.total ?? null),
              cupom: String(rv.cupom ?? ''),
              expira_em: expiraWa,
            };
            if (rv.wa_button_url && waCart?.url && entry.person_id) {
              waLink = await createTrackedLinkDetailed(supabase, {
                destination: waCart.url, peopleId: entry.person_id, leadId: entry.lead_id, channel: 'whatsapp',
                source: 'esteira_whatsapp', label: 'wa_button_url', templateName: resolvedTemplateName, followupQueueId: entry.id,
                abVariantId: (entry as { ab_variant_id?: string | null }).ab_variant_id ?? null,
              });
            }
            // WA-IMG: template com header de imagem SEMPRE recebe um link (Meta rejeita header vazio).
            const headerFallback = Deno.env.get('WA_HEADER_FALLBACK_IMAGE')
              || `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/email-assets/prod-fosca.jpg`;
            const headerImageUrl = headerKind === 'image' ? resolveHeaderImage(rv, waCart, headerFallback) : null;
            msgComponents = buildEsteiraWaComponents({
              templateComponents: tplComponents, waParams, waVars, ruleVars: rv, buttonToken: waLink?.token ?? null, headerImageUrl,
            });
          }
```
(O caso "header TEXT com `{{nome}}` → stub `text:''`" continua coberto por `buildEsteiraWaComponents`; `whatsapp-outbound` preenche com o nome.)

- [ ] **Step 3: E-mail e SMS** — nas chamadas `createTrackedLink(...)` de e-mail (`link_novo_checkout`, `link_checkout`) e SMS acrescentar `abVariantId: (entry as { ab_variant_id?: string | null }).ab_variant_id ?? null`. Se o `select` da fila for explícito (não `*`), incluir `ab_variant_id`.

- [ ] **Step 4: Inbox** — no `insert` em `messages` do WA, quando `headerImageUrl` existir, gravar `media_url: headerImageUrl` (a bolha mostra a foto). Sem mudar `message_type`.

- [ ] **Step 5: Verificar e commitar** — `deno check supabase/functions/followup-trigger-worker/index.ts`; grep de sanidade: `grep -n "headerParamName" supabase/functions/followup-trigger-worker/index.ts` → nada.
`git commit -m "feat(esteira): WhatsApp com header de imagem (SKU/fixa/fallback) e variante A/B nos links"`

---

### Task 6: `ai-agent-execute` — produto do carrinho no contexto + tool `consultar_produto`

**Files:** Modify `supabase/functions/ai-agent-execute/index.ts` · Depende de: Task 4.

- [ ] **Step 1: Contexto** — no bloco EST-AGENT, logo após `linhas.push(\`Carrinho abandonado: …\`)` (dentro do `if (cart.produto || cart.url)`):

```ts
        if (cart.productId) {
          const { resolveProductSummary, describeProductForAgent } = await import('../_shared/yampi-product.ts');
          const ps = await resolveProductSummary(supabase as never, cart.productId);
          if (ps) linhas.push(describeProductForAgent(ps));
        }
```

- [ ] **Step 2: Tool** — em `TOOL_DEFINITIONS`, depois de `verificar_compatibilidade`:

```ts
  {
    name: 'consultar_produto',
    description: 'Fetches the full product sheet from the Yampi catalog (description, material, available colors and phone models, price range, stock per variant). Default: the product in the contact\'s latest cart. Use when the contact asks about material, what comes in the box, colors, models, warranty or anything the CONTEXT block "Produto do carrinho" does not answer. Never invent specs.',
    parameters: { type: 'object', properties: {
      product_id: { type: 'integer', description: 'Optional Yampi product id. Default: product of the latest cart.' },
      force: { type: 'boolean', description: 'Optional. Refresh the cache (price/stock changed).' },
    }, required: [] },
  },
```
Em `executeTool`, antes de `case 'yampi_consultar_pedido'`:
```ts
      case 'consultar_produto': {
        const { resolveProductSummary } = await import('../_shared/yampi-product.ts');
        let pid = Number(args.product_id ?? 0) || 0;
        if (!pid && ctx.pessoa_id) {
          const { resolveCartForPerson } = await import('../_shared/tracked-links.ts');
          pid = (await resolveCartForPerson(supabase as never, ctx.pessoa_id)).productId ?? 0;
        }
        if (!pid) return 'Não achei o produto do carrinho. Pergunte qual case o cliente quer (verificar_compatibilidade ajuda a localizar) ou informe product_id.';
        const ps = await resolveProductSummary(supabase as never, pid, { force: args.force === true });
        if (!ps) return 'Não consegui consultar o catálogo agora. Responda com o que está no CONTEXTO e ofereça confirmar depois.';
        const { variantesDetalhe, ...resto } = ps;
        return JSON.stringify({ ...resto, variantes_detalhe: variantesDetalhe.slice(0, 12) });
      }
```

- [ ] **Step 3: Verificar e commitar** — `deno check supabase/functions/ai-agent-execute/index.ts`.
`git commit -m "feat(agente): contexto e tool consultar_produto com dados do catálogo Yampi"`

---

### Task 7: `yampi-process-event` — variante A/B na reconversão

**Files:** Modify `supabase/functions/yampi-process-event/index.ts` · Depende de: Task 0 (nomes).

- [ ] **Step 1:** antes do `await supabase.from('esteira_reconversions').upsert({…})`:
```ts
        const { data: abRow } = leadId
          ? await supabase.from('esteira_ab_assignments').select('experiment_id, variant_id').eq('lead_id', leadId).order('assigned_at', { ascending: false }).limit(1).maybeSingle()
          : { data: null };
```
e no objeto do upsert: `ab_experiment_id: (abRow as { experiment_id?: string } | null)?.experiment_id ?? null, ab_variant_id: (abRow as { variant_id?: string } | null)?.variant_id ?? null,`. Log `reconversion_recorded` ganha `ab_variant: … ?? 'none'`.

- [ ] **Step 2:** `deno check supabase/functions/yampi-process-event/index.ts` · `git commit -m "feat(ab): reconversão carrega experimento/variante do lead"`

---

### Task 8: Edge function `email-template-test-send`

**Files:** Create `supabase/functions/email-template-test-send/index.ts` · Independente.

**Contrato:** `POST { to: string; subject: string; html: string; vars?: Record<string,string> }` → `{ success: true, provider }` | `{ success: false, error }` (sempre HTTP 200 exceto 401/403, para o `functions.invoke` entregar a mensagem).

- [ ] **Step 1: Implementar** (modelo: `channel-test-send`)
  1. Auth: `Authorization: Bearer <jwt>` → `supabase.auth.getUser` (anon client com o header) → `settings_users` por `auth_user_id`: exige `active && deleted_at IS NULL && (super_admin || user_type === 'manager')`, senão 403 `"Só gestores podem enviar teste."`.
  2. Validação (zod): `to` e-mail; `subject` ≤ 300; `html` ≤ 200_000 chars; `vars` objeto de strings (≤ 60 chaves).
  3. `omni_channel_configs` canal `email`: `select('credentials, settings')`. `const allow = (settings?.email_test_recipients ?? []) as string[]`; se `!allow.map(lower).includes(to.lower)` → `{ success:false, error: 'Destinatário fora da lista de e-mails de teste (Configurações → Integrações → E-mail → "E-mails de teste").' }`.
  4. `hasDirectEmailProvider(creds)` senão erro. `sendEmailWithConfig({ is_active: true, credentials: creds }, { to, subject: \`[TESTE] ${subject}\`, html, vars })`. **Não** ler `sends_locked`: se o Klaviyo estiver travado, `sendEmailWithConfig` devolve `KLAVIYO_LOCKED_MSG` e a função só repassa `result.error`.
  5. Log sem HTML e sem credenciais (`to`, `bytes`, `provider`, `success`).

- [ ] **Step 2:** `deno check supabase/functions/email-template-test-send/index.ts` · `git commit -m "feat(email): função de envio de teste de template com lista própria de destinatários"`

---

### Task 9a: Funções puras do front — Timeline, split A/B, `vars` da regra

**Files:** Create `src/lib/followups/timeline.ts`, `timeline.test.ts`, `ab.ts`, `ab.test.ts`, `waRuleVars.ts`, `waRuleVars.test.ts`

**Interfaces:**
```ts
// timeline.ts
export type TemplateStatus = 'aprovado' | 'em_analise' | 'rejeitado' | 'sem_template' | 'nao_aplica';
export type Canal = 'email' | 'whatsapp' | 'sms' | 'outro';
export interface TimelineRule { id: string; offsetMin: number; label: string; canal: Canal; ativo: boolean; templateStatus: TemplateStatus; templateName: string | null; tracked: boolean; headerImage: boolean; variantId: string | null; ctr: { enviados: number; clicados: number; ctr: number | null } | null; placement: 'above' | 'below' }
export interface Lane { variantId: string | null; key: string; name: string; rules: TimelineRule[] }   // key 'comum' | 'A' | 'B'
export interface StageTimeline { stageId: string; lanes: Lane[]; maxOffsetMin: number }
export interface VariantLite { id: string; key: string; name: string; position: number }
export function offsetOf(r: { dias: number; horas: number; minutos: number }): number
export function minToParts(min: number): { dias: number; horas: number; minutos: number }
export function snapOffset(min: number, scaleMax: number): number      // ≤360→5 · ≤2880→15 · senão 60; nunca < 5; nunca negativo
export function formatTempo(dias: number, horas: number, minutos: number): string   // igual ao StageFollowupsCard ('Imediato' se 0)
export function labelPlacement(offsets: number[], scaleMax: number, minGapPct?: number): Array<'above' | 'below'>
export function templateStatusOf(rule, templates): TemplateStatus     // igual à Task 13b do plano anterior
export function buildStageTimeline(followups, templates, clickRates, variants: VariantLite[]): StageTimeline[]
// ab.ts
export function bucketFromMd5Hex(hex: string): number                  // parseInt(hex.slice(0,6),16) % 10000 — espelho do SQL
export function pickVariant<T extends { weight: number }>(bucket: number, variants: T[]): T | null
export function expectedSplit(variants: Array<{ key: string; weight: number }>): string   // 'A 50% · B 50%'
export function variantTone(key: string | null): 'neutral' | 'info' | 'violet' | 'warning'  // comum·A·B·C
export type AbStatus = 'draft' | 'running' | 'paused' | 'finished';
export function abStatusLabel(s: AbStatus): string      // Rascunho · Em andamento · Pausado · Encerrado
// waRuleVars.ts
export const WA_VAR_OPTIONS = ['nome','remetente','produto','modelo_celular','preco','cupom','expira_em'] as const;
export interface RuleVars { waParams: string[]; waButtonUrl: boolean; waHeaderMode: 'sku' | 'fixa' | null; waHeaderImage: string | null; cupom: string; cupomPct: string; expiraHoras: string }
export function parseRuleVars(vars: Record<string, unknown> | null | undefined): RuleVars
export function serializeRuleVars(rv: RuleVars, prev?: Record<string, unknown> | null): Record<string, unknown>   // merge: preserva chaves desconhecidas; remove vazias
export function bodyPlaceholders(components: unknown): number[]
export function templateHeaderKind(components: unknown): 'none' | 'text' | 'image' | 'video' | 'document'
export function buttonHasDynamicUrl(components: unknown): boolean
```

- [ ] **Step 1: Testes (falham)** — `timeline`: reaproveitar o teste da Task 13b do plano anterior (mesma fixture) acrescentando `variants=[{id:'vA',key:'A',…},{id:'vB',key:'B',…}]` e uma regra com `ab_variant_id:'vB'` → `lanes` = `[comum(3 regras), A(0), B(1)]` na ordem; regra com `vars.wa_header_mode` → `headerImage:true`; `snapOffset(37, 300)` → 35; `snapOffset(1000, 2000)` → 1005 (múltiplo de 15); `snapOffset(5000, 9000)` → 5040; `minToParts(1470)` → `{dias:1,horas:0,minutos:30}`; `labelPlacement([0, 30, 1440], 1440)` → `['above','below','above']`. `ab`: `bucketFromMd5Hex('ffffff00')` → 7215; `pickVariant(4999, [A50,B50])` → A; `pickVariant(5000, …)` → B; pesos 0/100 → sempre o segundo; lista vazia → null; `expectedSplit` → `'A 50% · B 50%'`. `waRuleVars`: `parseRuleVars({wa_params:['nome'], wa_button_url:true, cupom:'VOLTA10', x:1})` → campos; `serializeRuleVars(rv, {x:1})` mantém `x`, omite `wa_header_image` vazio, converte `cupom_pct` string; `bodyPlaceholders([{type:'BODY',text:'{{2}} {{1}}'}])` → `[2,1]`.

- [ ] **Step 2: Implementar** — `buildStageTimeline`: agrupa por `leads_stages_id`; para cada stage cria lanes `[comum, ...variants ordenadas por position]` (lanes de variante existem mesmo vazias, para o "clique no trilho vazio" criar direto na raia); `maxOffsetMin` = maior offset entre todas as lanes do stage; `placement` calculado por lane com `labelPlacement`. `templateStatusOf`/`ctrByTemplate` iguais à Task 13b.

- [ ] **Step 3: Verificar e commitar** — `npm test -- src/lib/followups` verde; `npx eslint src/lib/followups`.
`git commit -m "feat(followups): lógica pura da timeline, split A/B e vars da regra"`

---

### Task 9b: Funções puras — BI do A/B e preview de e-mail

**Files:** Create `src/lib/bi/abTest.ts`, `abTest.test.ts` · Modify `src/lib/emailTemplatePreview.ts` · Create `src/lib/emailTemplatePreview.test.ts`

**Interfaces:**
```ts
// abTest.ts
export interface AbVariantRow { id: string; key: string; name: string; is_control: boolean; weight: number }
export interface AbInput { variants: AbVariantRow[]; assignments: Array<{ variant_id: string; lead_id: string }>;
  touches: Array<{ ab_variant_id: string | null; person_id: string | null }>;            // followup_queue status=sent
  links: Array<{ ab_variant_id: string | null; clicks: number }>;
  reconversions: Array<{ ab_variant_id: string | null; order_total: number | null; attributed: boolean }> }
export interface AbVariantStats { id: string; key: string; name: string; isControl: boolean; leads: number; tocados: number; enviados: number; clicados: number; ctr: number | null; reconvertidos: number; taxa: number | null; receita: number; ticket: number | null }
export interface AbConfidence { nivel: 'insuficiente' | 'baixa' | 'media' | 'alta'; z: number | null; p: number | null; lift: number | null; melhor: string | null }
export function twoProportionZ(s1: number, n1: number, s2: number, n2: number): { z: number; p: number } | null   // null se n<1 ou pooled 0/1
export function normalCdf(z: number): number
export function aggregateAbTest(i: AbInput, minLeads?: number): { variants: AbVariantStats[]; confidence: AbConfidence }
// emailTemplatePreview.ts (adições; assinaturas antigas continuam válidas)
export const buildPreviewDocument = (renderedBody: string, opts?: { width?: number }): string   // width → <style>body{max-width:Wpx;margin:0 auto}
export interface LeadPreviewInput { name: string | null; cart: { produto: string | null; modelo: string | null; modeloCurto: string | null; imagem: string | null; total: number | null; url: string | null } | null }
export const previewVarsFromLead = (i: LeadPreviewInput): Record<string, string>   // nome (1º nome), produto, modelo_celular, modelo_celular_curto (UPPER do curto), imagem_produto, total/preco (BRL), link_checkout; sem carrinho → só nome
```

- [ ] **Step 1: Testes (falham)** — `twoProportionZ(50,1000,70,1000)` → `z` ≈ -1.88 (`toBeCloseTo(-1.88, 1)`), `p` entre 0.055 e 0.065; `normalCdf(0)` = 0.5, `normalCdf(1.96)` ≈ 0.975 (2 casas); `aggregateAbTest` com 2 variantes, 40+40 leads, 10 vs 16 reconvertidos → `taxa` 0.25/0.40, `lift` 0.6, `nivel` `'baixa'|'media'` (p ≈ 0.15 → `'baixa'`), `melhor 'B'`; com 10 leads → `'insuficiente'` e `z null`. `previewVarsFromLead({ name: 'Ana Paula', cart: { produto: 'Case X', modelo: 'iPhone 17 Pro', modeloCurto: 'iPhone 17', imagem: 'u', total: 142.9, url: 'https://c' } })` → `{ nome:'Ana', produto:'Case X', modelo_celular:'iPhone 17 Pro', modelo_celular_curto:'IPHONE 17', imagem_produto:'u', total:'R$ 142,90', preco:'R$ 142,90', link_checkout:'https://c' }`; `buildPreviewDocument('<p>x</p>', { width: 375 })` contém `max-width:375px`.

- [ ] **Step 2: Implementar** — `normalCdf` via erf de Abramowitz–Stegun 7.1.26; `nivel`: `insuficiente` se alguma variante < `minLeads` (30); senão `p < 0.05 → alta`, `< 0.2 → media`, senão `baixa`; `lift = (taxaMelhor - taxaControle)/taxaControle` (controle = `is_control` ou a primeira). `tocados` = pessoas distintas em `touches` da variante; `enviados/clicados` de `links`.

- [ ] **Step 3: Verificar e commitar** — `npm test -- src/lib/bi src/lib/emailTemplatePreview` verde.
`git commit -m "feat(bi): agregação do teste A/B com significância; preview de e-mail por largura e lead real"`

---

### Task 10: Hooks, deps e `AssetPicker`

**Files:** Modify `src/hooks/useFollowups.ts`, `package.json` (+ lock) · Create `src/hooks/useAbExperiments.ts`, `src/hooks/useEmailTemplateVersions.ts`, `src/hooks/useEmailAssets.ts`, `src/components/config/AssetPicker.tsx`

- [ ] **Step 1: Deps** — `npm i @uiw/react-codemirror @codemirror/lang-html @codemirror/view` (pinar as versões que o npm resolver). Commit separado: `chore(deps): codemirror para o editor de HTML`.

- [ ] **Step 2: `useFollowups.ts`** — `StageFollowup` ganha `vars: Record<string, unknown> | null; ab_variant_id: string | null`; `DbFollowup` idem (`vars`, `ab_variant_id`); `mapDbToFollowup` copia; `FollowupMutationInput` ganha `vars?: Record<string, unknown> | null; ab_variant_id?: string | null`; `buildInsert` grava `vars: d.vars ?? {}` e `ab_variant_id: d.ab_variant_id ?? null`. Novo:

```ts
export interface FollowupPatch { id: string; dias?: number; horas?: number; minutos?: number; ativo?: boolean; ab_variant_id?: string | null }
export const useUpdateFollowupFields = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dias, horas, minutos, ativo, ab_variant_id }: FollowupPatch) => {
      const patch: Record<string, unknown> = {};
      if (dias !== undefined) patch.days = dias; if (horas !== undefined) patch.hours = horas; if (minutos !== undefined) patch.minutes = minutos;
      if (ativo !== undefined) patch.active = ativo; if (ab_variant_id !== undefined) patch.ab_variant_id = ab_variant_id;
      const { error } = await (supabase as any).from('leads_stages_followups').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
    onError: () => toast.error('Erro ao atualizar o toque'),
  });
};
```
(sem toast de sucesso — o arrastar é frequente).

- [ ] **Step 3: `useAbExperiments.ts`** (`db = supabase as unknown as SupabaseClient`)
```ts
export interface AbVariant { id: string; experiment_id: string; key: string; name: string; weight: number; is_control: boolean; position: number }
export interface AbExperiment { id: string; pipeline_id: string; name: string; hypothesis: string | null; status: AbStatus; started_at: string | null; paused_at: string | null; finished_at: string | null; winner_variant_id: string | null; created_at: string; variants: AbVariant[] }
export function useAbExperiments(pipelineId?: string)       // ['ab-experiments', pipelineId] · select('*, variants:esteira_ab_variants(*)') order created_at desc; variants ordenadas por position
export function useLiveAbExperiment(pipelineId?: string)    // derivado: status in (running, paused) ?? null
export function useCreateAbExperiment()                     // { pipeline_id, name, hypothesis, variants: Array<{ key; name; weight; is_control }> } → insert experiment → insert variants (position = índice) → invalidate
export function useUpdateAbExperiment()                     // { id, name?, hypothesis?, status? } — status: running seta started_at (se null) e paused_at null; paused seta paused_at
export function useUpdateAbVariant()                        // { id, name?, weight? }
export function usePromoteAbWinner()                        // rpc('promote_ab_winner', { p_experiment_id, p_winner }) → invalidate ['ab-experiments'], ['all-followups'], ['stage-followups']
export function useFinishAbExperiment()                     // rpc('finish_ab_experiment', { p_experiment_id })
export function useAbAssignmentCounts(experimentId?: string) // select('variant_id') → Record<variantId, number> (limit 10000)
```
Toasts em pt-BR: "Teste criado", "Teste iniciado", "Teste pausado", "Vencedora promovida — regras da variante viraram comuns", "Teste encerrado".

- [ ] **Step 4: `useEmailTemplateVersions.ts`** — `useEmailTemplateVersions(templateId?)` → `select('id, name, subject, html_body, variables, saved_by, created_at')` order desc limit 30; `useDeleteEmailTemplateVersion()`.

- [ ] **Step 5: `useEmailAssets.ts`** — extrair do `EmailAssetsManager` (sem alterá-lo): `EMAIL_ASSETS_PUBLIC_BASE` (re-exportar o de `KlaviyoExtras.tsx`), `useEmailAssets(prefix = '')` (`storage.from('email-assets').list(prefix, { limit: 200 })`, filtra placeholder, devolve `{ name, path, url }`), `useUploadEmailAsset()` (`{ file, prefix }` → nome saneado `lower().replace(/[^a-z0-9._-]/g,'-')` → `upload(`${prefix}${name}`, file, { upsert: true, contentType })` → `{ url }`; invalida `['email-assets']`).

- [ ] **Step 6: `AssetPicker.tsx`** — `interface Props { open: boolean; onOpenChange(o: boolean): void; onSelect(url: string): void; prefix?: string; accept?: string }`. `Dialog` `max-w-2xl`: grid `grid-cols-4 gap-3` de thumbs (`rounded-xl border border-border`, `aspect-square object-cover`, nome `text-[11px] truncate`); botão "Enviar imagem" (input file oculto; JPEG/PNG/GIF/WebP; ≤ 5 MB → toast erro); clique na thumb → `onSelect(url)` e fecha; estado vazio "Nenhuma imagem nesta pasta." Sem emoji.

- [ ] **Step 7: Verificar e commitar** — `npx tsc … | grep -E "useFollowups|useAbExperiments|useEmailTemplateVersions|useEmailAssets|AssetPicker"` → nada novo; `npx eslint` nos arquivos.
`git commit -m "feat(hooks): vars e variante nas regras, experimentos A/B, versões e assets de e-mail, AssetPicker"`

---

### Task 11: `FollowupModal` — parâmetros WA, header de imagem, variáveis da regra, variante A/B, offset inicial, editor de código

**Files:** Modify `src/components/followups/FollowupModal.tsx` · Depende de: Task 9a, Task 10 (e do `HtmlCodeEditor` da Task 15 — se ainda não existir, deixe o toggle de código com o `Textarea` mono e um `// TODO(Task 15)`).

- [ ] **Step 1: Props** — `initialOffsetMin?: number; initialVariantId?: string | null`. Em `defaultForm`, quando `initialOffsetMin` vier: `minToParts()` → `dias/horas/minutos`; `ab_variant_id: initialVariantId ?? null`. `FormState` ganha `vars: RuleVars` (de `parseRuleVars`) e `ab_variant_id: string | null`; ao editar, `vars: parseRuleVars(followup.vars)`.

- [ ] **Step 2: Variante A/B** — `const stagePipelineId = selectedStage?.leads_pipelines_id`; `const live = useLiveAbExperiment(stagePipelineId)`. Se `live`: `Select` "Variante do teste A/B" com opções "Comum (todas as variantes)" + `live.variants` (`${key} · ${name}`); texto de apoio "Regras comuns disparam para todo mundo; regras de variante só para leads atribuídos a ela."

- [ ] **Step 3: WhatsApp** — depois do botão do template, com `tpl = whatsappTemplates.find(t => t.id_template === form.template_id)`, `comps = tpl?.json_data?.components`:
  - `bodyPlaceholders(comps)` > 0 → bloco "Parâmetros do corpo": uma linha por `{{n}}` com `Select` das `WA_VAR_OPTIONS` (rótulos: Primeiro nome · Remetente · Produto · Modelo do celular · Preço · Cupom · Expira em) → `vars.waParams[n-1]`. Aviso amarelo se algum ficar vazio ("A Meta rejeita o envio com parâmetro faltando").
  - `buttonHasDynamicUrl(comps)` → `Switch` "Botão com link rastreado do carrinho" → `vars.waButtonUrl`.
  - `templateHeaderKind(comps) === 'image'` → bloco "Imagem do cabeçalho": rádio "Foto do produto do carrinho (SKU)" / "Imagem fixa" → `vars.waHeaderMode`; em ambos, botão "Escolher imagem" abre `AssetPicker` (`prefix="wa-headers/"`) → `vars.waHeaderImage` (no modo SKU vira fallback; explicar em `text-[11px]`); thumb 64 px da imagem escolhida.
  - Mostrar `Chip` de status do template (Aprovado/Em análise/Rejeitado) ao lado do nome.

- [ ] **Step 4: Variáveis da regra (todos os canais)** — bloco colapsável "Variáveis da regra": `Input` Cupom, Cupom % (numérico), Expira em (horas). Texto: "Usadas em {{cupom}}, {{cupom_pct}} e {{expira_em}} dos templates."

- [ ] **Step 5: E-mail manual** — toggle "Editor / Código HTML" acima do `FollowupEmailEditor` (mesmo padrão do `EmailTemplateEditorModal`); modo código usa `HtmlCodeEditor` (lazy) quando existir.

- [ ] **Step 6: Payload** — `vars: serializeRuleVars(form.vars, followup?.vars)`, `ab_variant_id: form.ab_variant_id`. Validação extra para WA: se `bodyPlaceholders(comps).length > 0` e algum `waParams[i]` vazio → `toast.error('Preencha todos os parâmetros do template.')`.

- [ ] **Step 7: Verificar e commitar** — `npx tsc … | grep FollowupModal` sem erro novo; visual: abrir "+ Adicionar" num stage, escolher template WA com `{{1}}{{2}}` → 2 selects; salvar → `select vars from leads_stages_followups where id=…` mostra `wa_params`.
`git commit -m "feat(followups): modal configura parâmetros WA, header de imagem, variáveis da regra e variante A/B"`

---

### Task 12: Aba "Timeline" em `/followups` (com painel A/B)

**Files:** Create `src/components/followups/EsteiraTimelineTab.tsx`, `StageTimelineCard.tsx`, `TimelineMarker.tsx`, `AbExperimentPanel.tsx` · Modify `src/pages/Followups.tsx` · Depende de: 9a, 10, 11.

- [ ] **Step 1: `EsteiraTimelineTab`** — dados: `usePipelines()`, `useAllFollowups()`, `useWhatsappTemplates()`, `useTrackedClicksRealtime()`, query `['tracked-links','rates']` (`tracked_links` `select('source, label, template_name, channel, clicks')` últimos 30 d, limit 10000 → `aggregateClickRates`), `useAbExperiments(pipelineId)`. `Select` de pipeline (default: ativo com mais regras). Cabeçalho: nome do pipeline · "N toques" · botão "Sincronizar templates com a Meta" (replica a chamada de `WhatsappTemplatesConfig`: `supabase.functions.invoke('whatsapp-templates-sync', { body: { channel_id } })` com o canal default de `useWhatsappChannels`, invalida `['whatsapp-templates']`; só admin/manager como lá). Abaixo, `AbExperimentPanel`. Depois, um `StageTimelineCard` por stage ativo do pipeline (ordem `order_index`), com `buildStageTimeline(followupsDoPipeline, templates, rates, live?.variants ?? [])`. Estado vazio: "Nenhum toque configurado neste pipeline. Clique no trilho para criar o primeiro."

- [ ] **Step 2: `StageTimelineCard`** — `rounded-xl border border-border bg-card p-5`; cabeçalho `text-[13px] font-medium` nome do stage + `text-[11px] text-muted-foreground` "N toques · até {formatTempo(max)}"; régua com marcas em 0 · 1h · 6h · 1d · 2d · 3d… (só as ≤ max, `text-[10px] tabular-nums`); uma **raia por lane** (`min-h-[72px] relative`): rótulo à esquerda (`Chip tone={variantTone(key)}` "Comum"/"A · Controle"/"B · Nome"); trilho `absolute left-24 right-4 top-1/2 h-px bg-border`; `TimelineMarker` por regra; **clique no trilho vazio** → `FollowupModal` com `stageId`, `initialOffsetMin = snapOffset(round(pct*max), max)`, `initialVariantId = lane.variantId`. Raias de variante só aparecem com experimento `running|paused`; se há regras órfãs (variante de experimento encerrado) mostrar raia "Variante encerrada" em `opacity-60`.

- [ ] **Step 3: `TimelineMarker`** — botão redondo 28 px (`rounded-full border bg-card`), ícone do canal (`Mail`/`MessageCircle`/`Smartphone`), `opacity-50` se inativo, anel `ring-2 ring-red-500/40` se `templateStatus` ∈ {rejeitado, sem_template}; `aria-label` "E1 · e-mail · 30 min"; etiqueta acima/abaixo (`placement`) com `formatTempo` + rótulo truncado (`max-w-[140px]`) + chips: status do template (success/warning/danger), `tracked` → info "link", `headerImage` → info "foto", `ctr` → neutral "4/10 · 40%". **Arrastar:** `onPointerDown` captura; `onPointerMove` move visualmente (`left` em %); `onPointerUp` → `min = snapOffset(pct*max, max)`; se mudou → `useUpdateFollowupFields({ id, ...minToParts(min) })`; sem mover (< 4 px) → clique = abre `FollowupModal` (editar). Menu de contexto (`DropdownMenu` no botão direito ou botão "…" no hover): Editar · Ligar/Desligar (`ativo`) · Duplicar para <variante> (`useCreateFollowup` com a regra + `ab_variant_id`) · Mover para <raia> (`ab_variant_id`) · Pré-visualizar (reaproveita os dois `Dialog` de preview do `StageFollowupsCard`) · Excluir (mesmo `AlertDialog`).

- [ ] **Step 4: `AbExperimentPanel`** — `rounded-xl border border-border bg-card p-5`. Sem experimento vivo: texto "Teste A/B: compare duas sequências de toques com leads divididos automaticamente." + botão "Criar teste A/B" → `Dialog` (nome, hipótese, 2 variantes fixas A (controle) e B com nome e peso somando 100 — slider ou dois inputs). Com experimento: nome, `Chip` de status (`abStatusLabel`), `expectedSplit`, contagem por variante (`useAbAssignmentCounts`), botões: Rascunho → "Iniciar"; Em andamento → "Pausar" · "Encerrar…"; Pausado → "Retomar" · "Encerrar…". "Encerrar…" abre `AlertDialog` com rádio "Promover vencedora: A/B" ou "Encerrar sem vencedora" e o aviso "Regras da vencedora viram comuns; as das outras variantes ficam inativas." Ao **pausar**, aviso amarelo "N regras de variante não vão disparar enquanto o teste estiver pausado." Link "Ver resultados no BI" → `/dashboard` aba Reconversão (rota existente do BI PRO).

- [ ] **Step 5: `Followups.tsx`** — `<TabsTrigger value="timeline">Timeline</TabsTrigger>` entre "Etapas CRM" e "Agendamento"; `<TabsContent value="timeline" className="mt-0"><EsteiraTimelineTab /></TabsContent>`.

- [ ] **Step 6: Verificar e commitar** — tsc/eslint sem erro novo; visual em 1280 px claro/escuro: esteira com E1/SMS/WA em ordem, arrastar um toque de 2 h para 3 h atualiza o card "Etapas CRM" (invalidado), clique no vazio cria com offset pré-preenchido, painel A/B cria/inicia/pausa.
`git commit -m "feat(followups): aba Timeline — toques por stage no tempo, arrastar/criar/duplicar, raias e painel do teste A/B"`

---

### Task 13: Builder de template WhatsApp com header "Imagem" + render no preview/detalhes

**Files:** Modify `src/components/config/WhatsappTemplateBuilderModal.tsx`, `WhatsappTemplateDetails.tsx`, `WhatsappTemplatePreview.tsx` · Depende de: Task 3 (contrato `header_image_url`), Task 10 (`AssetPicker`).

- [ ] **Step 1: Builder** — estado `headerType: 'none' | 'text' | 'image'` (default `'none'`; presets com `header` não vazio → `'text'`), `headerImageUrl: string`. UI do cabeçalho: `Select` Tipo (Nenhum / Texto / Imagem); Texto → input atual; Imagem → thumb + botão "Escolher imagem" (`AssetPicker prefix="wa-headers/"`) + nota "JPEG ou PNG até 5 MB. Recomendado 800×418 (1,91:1). A Meta exige o App ID do canal para subir a imagem." `buildComponents()`: só empurra HEADER TEXT quando `headerType==='text'`; payload do `handleCreate` ganha `...(headerType === 'image' && headerImageUrl ? { header_image_url: headerImageUrl } : {})`. `isValid()` exige imagem quando `headerType==='image'`. `buildPreviewComponents()` inclui `{ type: 'HEADER', format: 'IMAGE', image_url: headerImageUrl }` para o preview.

- [ ] **Step 2: Preview/Detalhes** — `WhatsappTemplatePreview`: se componente `HEADER` com `format==='IMAGE'`, renderizar `<img>` (`image_url` ?? `json_data.header_image_url` ?? placeholder cinza com ícone `Image` e "Imagem do cabeçalho") em `rounded-lg aspect-[1.91/1] object-cover w-full`. `WhatsappTemplateDetails`: idem no `result.push` (novo tipo `{ type:'HEADER_IMAGE', url }`).

- [ ] **Step 3: Verificar e commitar** — tsc/eslint sem erro novo; visual: criar `mc_teste_img` **não é feito aqui** (QA na Task 16).
`git commit -m "feat(wa): builder de template com header de imagem e render no preview"`

---

### Task 14: BI — card "Teste A/B" · chip da variante no lead

**Files:** Create `src/hooks/useAbTestBI.ts`, `src/components/dashboard/reconversao/AbTestCard.tsx` · Modify `src/components/dashboard/BIProReconversaoTab.tsx`, `src/hooks/useEsteiraLead.ts`, `src/components/negocios/NegocioEsteira.tsx` · Depende de: 9b, 10.

- [ ] **Step 1: `useAbTestBI()`** — `['bi-ab']`, `staleTime 60_000`: experimentos com `status in (running, paused, finished)` e (`finished_at is null` ou ≥ 90 d) com `variants`; para cada experimento (máx. 3, mais recentes): `assignments` (`select('variant_id, lead_id')`, limit 10000), `followup_queue` (`select('ab_variant_id, person_id')` `.eq('status','sent')` `.in('ab_variant_id', variantIds)`), `tracked_links` (`select('ab_variant_id, clicks')` `.in(...)`), `esteira_reconversions` (`select('ab_variant_id, order_total, attributed')` `.eq('ab_experiment_id', id)`) → `aggregateAbTest`. Devolve `Array<{ experiment, stats, confidence }>`.

- [ ] **Step 2: `AbTestCard`** — por experimento: título + `Chip` status + período ("desde 05/09"); tabela compacta `text-[12px]` com linhas por variante (`Chip tone={variantTone(key)}` A/B · nome · leads · tocados · CTR · reconvertidos · **taxa** (`font-semibold tabular-nums`) · receita); barra comparativa de taxa (`bg-sky-500` A, `bg-violet-400` B); rodapé: `nivel` → "Amostra insuficiente (mínimo 30 leads por variante)" / "Confiança baixa · p=0,15" / "média" / "alta — B converte 60% mais que A". Sem experimento → não renderiza o card.

- [ ] **Step 3: `BIProReconversaoTab`** — inserir `<AbTestCard />` (usa o hook internamente) logo após `<ClickRateCard …/>`, mesma coluna/grid.

- [ ] **Step 4: Lead** — `useLeadEsteira` passa a devolver `abVariant: { key: string; name: string; experiment: string } | null` (uma query: `esteira_ab_assignments` `select('variant:esteira_ab_variants(key, name, experiment:esteira_ab_experiments(name))')` `.eq('lead_id', leadId)` order desc limit 1; erro → null). `NegocioEsteira`: no cabeçalho da aba, `Chip tone={variantTone(key)}` "Teste A/B · Variante B" com `title` = nome do experimento.

- [ ] **Step 5: Verificar e commitar** — tsc/eslint; visual no BI com o experimento de QA.
`git commit -m "feat(bi): card do teste A/B por variante com confiança; chip da variante no lead"`

---

### Task 15: Editor de e-mail — CodeMirror, preview desktop/mobile, lead real, imagens, teste, histórico

**Files:** Create `src/components/ui/html-code-editor.tsx` · Modify `src/components/config/EmailTemplateEditorModal.tsx` · Depende de: 8, 9b, 10.

- [ ] **Step 1: `HtmlCodeEditor`** — `interface Props { value: string; onChange(v: string): void; minHeight?: string; onInsertRef?: (fn: (text: string) => void) => void }`. `CodeMirror` de `@uiw/react-codemirror` com `extensions=[html()]`, `theme` = `'dark'` se `document.documentElement.classList.contains('dark')` senão `'light'`, `basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true }}`, fonte mono `text-[12px]`, `className="rounded-xl border border-border overflow-hidden"`. `onInsertRef` entrega uma função que insere texto na seleção atual (via `view.dispatch`). Exportar `default`; no modal importar com `React.lazy` + `Suspense` (fallback `Textarea` mono).

- [ ] **Step 2: Modal — editor** — trocar o `Textarea` do modo código pelo `HtmlCodeEditor`; `VariablePicker` insere via `onInsertRef`. Toolbar do corpo: "Editor / Código HTML" (existente) + "Inserir imagem" (abre `AssetPicker prefix=""`; insere `<img src="{{asset_base}}/<nome>" width="600" alt="" style="width:100%;max-width:600px;height:auto;">` no código, ou `editor.chain().focus().setImage({ src: url })` no tiptap se a extensão existir — senão só no modo código, com toast "Disponível no modo Código HTML").

- [ ] **Step 3: Modal — preview** — cabeçalho do preview ganha: toggle `Desktop | Mobile` (`ToggleGroup`), `Select` "Dados de exemplo": "Padrão" | "Lead real…" (abre `Popover` com busca em `clients_people` por nome/e-mail — `ilike`, limit 8 — ao escolher, busca o carrinho como `useLeadEsteira` faz (`yampi_webhook_events` da pessoa, `carrinho_abandonado|checkout_iniciado`, mais recente; extrair `produto/modelo/imagem/total/url` reaproveitando `splitProductModel`-like já existente no hook) → `previewVarsFromLead` → `overrides`). Iframe: contêiner `flex justify-center bg-muted/30 overflow-auto`, iframe `style={{ width: device==='mobile' ? 375 : 600 }}`, `srcDoc={buildPreviewDocument(renderPreview(htmlBody, overrides), { width })}`. Assunto do preview também usa `overrides`.

- [ ] **Step 4: Enviar teste** — botão "Enviar teste" no rodapé do preview → `Popover` com `Input` e-mail (default: último usado, `localStorage` `email-test-to`) e "Enviar" → `supabase.functions.invoke('email-template-test-send', { body: { to, subject, html: htmlBody, vars: overridesOuSample } })` (as `vars` = o mesmo mapa que o preview usou: `Object.fromEntries(detectedVars.map(v => [v, overrides[v] ?? sampleValueFor(v)]))`). Sucesso → toast "Teste enviado para …"; erro → toast com a mensagem do servidor (inclui a de trava do Klaviyo e a de destinatário fora da lista).

- [ ] **Step 5: Histórico** — botão "Histórico" (só ao editar) abre `Sheet` lateral: lista `useEmailTemplateVersions(template.id)` (data/hora `dd/MM HH:mm`, assunto, `saved_by` abreviado); ações "Ver" (troca o preview para a versão, com faixa "Vendo versão de …" e "Voltar") e "Restaurar" (`setSubject/setHtmlBody/setName` da versão + toast "Versão carregada no editor — salve para aplicar"). Estado vazio "Ainda não há versões anteriores."

- [ ] **Step 6: Verificar e commitar** — `npm run build` passa (lazy chunk do CodeMirror); tsc/eslint sem erro novo; visual claro/escuro.
`git commit -m "feat(email): editor de código HTML, preview desktop/mobile com lead real, imagens, envio de teste e histórico"`

---

### Task 16: Migrations (Management API), deploy, QA manual e push — controlador

**Files:** nenhum novo. Um executor, por último.

- [ ] **Step 1: Baseline**
```bash
cd /Volumes/nvme/minimal/Minimal-Cases-RevOS
npm test
deno test --allow-env --allow-net supabase/functions/_shared/ab-rules.test.ts supabase/functions/_shared/wa-template-render.test.ts supabase/functions/_shared/meta-media-upload.test.ts supabase/functions/_shared/yampi-product.test.ts supabase/functions/_shared/tracked-links-url.test.ts supabase/functions/_shared/click-classifier.test.ts
git stash; npx tsc -p tsconfig.app.json --noEmit 2>&1 | wc -l; git stash pop; npx tsc -p tsconfig.app.json --noEmit 2>&1 | wc -l   # depois ≤ antes
npm run build
```

- [ ] **Step 2: Foto das travas ANTES** (só leitura, pelo controlador, para comparar no fim):
```sql
select channel, settings->>'sends_locked' sl, settings->'test_allowlist' al, credentials->>'sends_locked' csl from omni_channel_configs where channel in ('whatsapp','email');
select id, agent_requires_outreach from ai_agents where name = 'Minimal · Recuperação WhatsApp';  -- se a coluna existir; senão a config equivalente
```
Guardar a saída.

- [ ] **Step 3: Confirmar a opção do E2 com a cliente** (spec §8.4); se não for a A, editar `20260905104000_e2_titulo.sql` antes de aplicar.

- [ ] **Step 4: Aplicar migrations via Management API**, em ordem, cada arquivo como uma query:
```bash
for f in supabase/migrations/20260905100000_esteira_ab_testing.sql supabase/migrations/20260905101000_wa_header_image.sql supabase/migrations/20260905102000_yampi_products_cache.sql supabase/migrations/20260905103000_email_template_versions.sql supabase/migrations/20260905104000_e2_titulo.sql; do
  jq -Rs '{query: .}' "$f" | curl -sS -X POST "https://api.supabase.com/v1/projects/maigkwlgzinykfvemexf/database/query" -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" -d @- ; echo " ← $f"
done
```
Verificar: `select count(*) from information_schema.tables where table_name in ('esteira_ab_experiments','esteira_ab_variants','esteira_ab_assignments','yampi_products_cache','email_template_versions')` → 5; `select proname from pg_proc where proname in ('assign_esteira_variant','promote_ab_winner','finish_ab_experiment')` → 3; `select column_name from information_schema.columns where table_name='leads_stages_followups' and column_name='ab_variant_id'` → 1; `select name, subject from email_templates where id='52e679cf-375e-4f6b-98d4-79311abe6702'` → título novo; `select enabled_tools from ai_agents where name='Minimal · Recuperação WhatsApp'` contém `consultar_produto`.

- [ ] **Step 5: Configurações** — `update omni_channel_configs set settings = coalesce(settings,'{}'::jsonb) || '{"email_test_recipients":["hyagosilvaxds@gmail.com"]}' where channel='email';` (chave nova; **não** tocar em `sends_locked`/`test_allowlist`). Informar o App ID da Meta no canal: `update settings_whatsapp_channels set app_id='<APP_ID da cliente>' where active;` (ou `supabase secrets set META_APP_ID=…`). Opcional: `supabase secrets set WA_HEADER_FALLBACK_IMAGE=https://…/email-assets/prod-fosca.jpg`.

- [ ] **Step 6: Deploy**
```bash
supabase functions deploy followup-enqueue followup-trigger-worker ai-agent-execute yampi-process-event whatsapp-templates-manage email-template-test-send
```

- [ ] **Step 7: QA — Timeline e vars**
  1. `/followups` → Timeline → pipeline "Esteira Validação": stages com E1/SMS/WA em ordem; chips de status do template; CTR onde houver.
  2. Arrastar um toque (ex.: SMS-01 de 2 h para 3 h) → `select hours from leads_stages_followups where id=…` = 3; voltar.
  3. Clicar no trilho vazio em ~1 d → modal com Dias=1; cancelar.
  4. Editar WA-01 → parâmetros do corpo listados na ordem do `vars.wa_params` atual; salvar sem mudar → `vars` idêntico (merge preserva chaves).

- [ ] **Step 8: QA — WhatsApp com foto (allowlist 5538991971527)**
  Pré-condição (já configurada pela operação; **não alterar aqui**): trava do WhatsApp liberada para a allowlist. Se travado, parar e pedir a quem opera.
  1. Configurações → Canais → WhatsApp → Templates → "Novo": nome `mc_teste_img`, categoria MARKETING, header **Imagem** (subir `wa-headers/teste.jpg` 800×418), corpo "Oi {{1}}, sua {{2}} está esperando.", botão URL `https://maigkwlgzinykfvemexf.supabase.co/functions/v1/r?t={{1}}` → "Criar". Esperado: `status pending`, `json_data.components[0]` = `HEADER IMAGE` com `header_handle`; erro da Meta legível caso o App ID não bata com o token.
  2. Sincronizar até `APPROVED` (pode levar horas; se demorar, seguir o resto e voltar).
  3. Na Validação, criar regra WA (stage Carrinho abandonado, 5 min, template `mc_teste_img`, params `nome`/`produto`, botão rastreado ON, header "Foto do produto do carrinho"). Mover o lead de teste do número da allowlist para o stage.
  4. Em ≤ 6 min: mensagem chega **com a foto do SKU** no topo; `select components from …` — checar no log do `followup-trigger-worker` o payload com `header image link`; `tracked_links` tem `ab_variant_id` null (sem experimento) e `message_id` preenchido; bolha do inbox mostra a imagem (`media_url`).
  5. Repetir com header "Imagem fixa" → chega a arte fixa. Remover a regra de teste; template `mc_teste_img` pode ficar (ou excluir pela UI).

- [ ] **Step 9: QA — A/B (Validação)**
  1. Timeline → "Criar teste A/B" (A controle 50 / B 50) → Iniciar.
  2. Duplicar E1 para B com 2 h (em vez de 30 min). Raias A (vazia), B (1 regra), Comum (as demais).
  3. Mover 6 leads de teste para "Carrinho abandonado" → `select variant_id, count(*) from esteira_ab_assignments group by 1` (≈ 3/3; determinístico por pessoa: mover o mesmo lead de novo não muda). `followup_queue` dos leads B tem E1 em 2 h e `ab_variant_id` = B; dos leads A, E1 em 30 min.
  4. Pausar → mover outro lead → só regras comuns na fila. Retomar.
  5. BI → Reconversão → card "Teste A/B": leads por variante; "Amostra insuficiente". Aba Esteira de um lead: chip "Teste A/B · Variante B".
  6. Encerrar → "Promover vencedora B" → regra B virou comum (`ab_variant_id null`), A inativas, experimento `finished`. Limpar as regras de teste.

- [ ] **Step 10: QA — agente com produto**
  Pelo número da allowlist, perguntar ao agente "essa case é de couro? tem em marrom?" → resposta usa material/cores do bloco "Produto do carrinho" (ver `ai_agent_executions`/log: `contexto_loja` com "Produto do carrinho:"); "o que vem na caixa?" → tool `consultar_produto` chamada (log). `select product_id, fetched_at from yampi_products_cache` → 1 linha.

- [ ] **Step 11: QA — editor de e-mail e teste (só hyagosilvaxds@gmail.com)**
  1. Configurações → Integrações → E-mail → Templates → editar o E2: modo Código com realce; Desktop/Mobile; "Dados de exemplo → Lead real" (buscar um lead com carrinho) → foto/produto reais no preview.
  2. "Inserir imagem" → sobe no bucket e insere `{{asset_base}}/…`.
  3. "Enviar teste" para `hyagosilvaxds@gmail.com` → se a trava do Klaviyo estiver fechada, a UI mostra a mensagem `KLAVIYO_LOCKED_MSG` (comportamento esperado; **não destravar**). Tentar `outro@exemplo.com` → "Destinatário fora da lista".
  4. Alterar o assunto e salvar → "Histórico" lista 1 versão; "Restaurar" traz o assunto antigo; salvar de novo → 2 versões.
  5. Conferir o título novo do E2 no preview e no card "Etapas CRM".

- [ ] **Step 12: Travas DEPOIS** — repetir o SQL do Step 2; a saída deve ser **idêntica**. `git diff origin/main -- supabase/functions/_shared/whatsapp-send-lock.ts supabase/functions/_shared/klaviyo-client.ts` → vazio; `grep -rn "sends_locked\|test_allowlist" supabase/functions/email-template-test-send supabase/functions/followup-enqueue src/components/followups src/lib/followups` → nada.

- [ ] **Step 13: Item 1 — checklist de fechamento** (só verificação): um clique real do QA acima aparece no card ("Clicou"), na aba Esteira (`kind:'clique'`), no inbox ("Link aberto") e no BI (CTR) sem F5. **Domínio curto (condicional, spec §8.1):** se a cliente aprovou — regra de redirect na Cloudflare, `supabase secrets set TRACKED_LINK_BASE_URL=https://link.minimalcases.com.br`, redeploy `followup-trigger-worker ai-agent-execute`, e as versões `_img` dos templates nascem com o botão `https://link.minimalcases.com.br/{{1}}`.

- [ ] **Step 14: Checklist visual** (claro/escuro, 1280 px): marcadores redondos, chips `rounded-full`, cards `rounded-xl`, nada de emoji em rótulo, textos 12–13 px, raias A/B em sky/violet.

- [ ] **Step 15: Push**
```bash
git add -f docs/superpowers/specs/2026-09-05-esteira-rodada-3.md docs/superpowers/plans/2026-09-05-esteira-rodada-3.md
git commit -m "docs(esteira): spec e plano da rodada 3"
git pull -q --rebase origin main && npm test && npm run build && git push origin main
```

---

## Self-review (feito pelo autor do plano)

- **Cobertura da spec:** O1 (16.13) · O2 Timeline (9a, 10, 12) · O3 vars na UI (9a, 10, 11) · O4 A/B (0, 1, 4, 5, 7, 9a, 9b, 10, 11, 12, 14) · O5 WA com foto (0, 2, 3, 5, 10, 11, 13) · O6 produto no agente (0, 4, 6) · O7 E2 (0) · O8 editor (0, 8, 9b, 10, 15) · QA real com allowlist e e-mail de teste único (16).
- **Travas:** nenhuma tarefa lê ou grava `sends_locked`/`test_allowlist`; o teste de e-mail usa a chave nova `email_test_recipients` e passa por `sendEmailWithConfig` (trava do Klaviyo intacta); o WA com foto sai por `whatsapp-outbound` sem alteração; a Task 16 compara a foto das travas antes/depois.
- **Consistência de nomes:** `assign_esteira_variant`/`promote_ab_winner`/`finish_ab_experiment` (0 → 1, 10, 12); `filterRulesForVariant` (1); `templateHeaderKind`/`bodyPlaceholders`/`buttonHasDynamicUrl`/`resolveHeaderImage`/`buildEsteiraWaComponents` (2 → 5; espelho TS em 9a → 11); `uploadHeaderHandle`/`header_image_url` (3 → 13); `getProduct`/`summarizeProduct`/`describeProductForAgent`/`resolveProductSummary`/`PersonCart.productId`/`abVariantId` (4 → 5, 6); `ab_variant_id` em fila/links/reconversões (0 → 1, 5, 7, 14); `useUpdateFollowupFields`/`useAbExperiments`/`useLiveAbExperiment`/`usePromoteAbWinner`/`useFinishAbExperiment`/`useAbAssignmentCounts`/`useEmailTemplateVersions`/`useEmailAssets`/`useUploadEmailAsset`/`AssetPicker` (10 → 11, 12, 13, 14, 15); `buildStageTimeline`/`snapOffset`/`minToParts`/`formatTempo`/`labelPlacement`/`variantTone`/`abStatusLabel`/`parseRuleVars`/`serializeRuleVars` (9a → 11, 12, 14); `aggregateAbTest`/`twoProportionZ`/`previewVarsFromLead`/`buildPreviewDocument(opts)` (9b → 14, 15); `email-template-test-send {to, subject, html, vars}` (8 → 15).
- **Arquivos disjuntos por tarefa:** `tracked-links.ts` só na Task 4; `wa-template-render.ts` só na 2; `useFollowups.ts` só na 10; `FollowupModal.tsx` só na 11; `EmailTemplateEditorModal.tsx` só na 15. `HtmlCodeEditor` nasce na 15 — a 11 tem fallback explícito se rodar antes.
- **Ordem/paralelismo:** declarados no Mapa; só a Task 16 aplica migration (via Management API) e faz deploy.
