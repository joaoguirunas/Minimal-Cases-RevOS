# Links rastreados v2 (origem · cliques · antibot · UI · agente · BI) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Todo link que sai do CRM (template WhatsApp, e-mail, SMS, botão do agente) sabe de qual toque nasceu; cada clique vira um evento com classificação humano/robô; crawlers de preview não contam nem movem o lead; o clique aparece no kanban, na timeline do lead, no inbox e no BI (taxa por toque) sem F5; o agente sabe que o cliente abriu o link; um gatilho reativo opcional (desligado por padrão) agenda um retorno do agente — sem tocar em nenhuma trava de envio.

**Architecture:** `tracked_links` ganha colunas de origem (`source`, `followup_queue_id`, `message_id`, `execution_id`, `template_name`, `label`) e uma tabela filha `tracked_link_clicks` (1 linha por hit, com `is_bot`/`is_duplicate`/`device`/`ip_hash`). A edge function `r` classifica a request com uma função pura (`classifyClick`), faz **uma** RPC (`record_tracked_click`) e responde `302`; progressão de stage e agendamento do agente rodam em `EdgeRuntime.waitUntil`. Os criadores de link (`followup-trigger-worker`, `ai-agent-execute`) passam a usar `createTrackedLinkDetailed()` e ligam o link à mensagem com `attachTrackedLinkMessage()`. No front, funções puras (`summarizeLinkClicks`, `clicksToTimeline`, `aggregateClickRates`) alimentam hooks existentes; um hook de realtime invalida as queries ao inserir clique.

**Tech Stack:** Supabase Postgres (plpgsql, RLS, pg_cron, realtime) · Edge Functions Deno 2 (`deno test`) · React 18 + TS + Tailwind/shadcn · TanStack Query v5 · date-fns 3 · Vitest (funções puras).

**Spec:** `docs/superpowers/specs/2026-09-04-links-rastreados.md`

## Global Constraints

- Raio: `rounded-xl` (12 px) em cards e tooltips; chips `rounded-full`. Nunca `rounded-[4px]`/`borderRadius: 4`.
- Tipografia: textos de UI `text-[12px]`–`text-[13px]`; rótulos `text-[11px] uppercase tracking-wide text-muted-foreground`; números grandes `font-semibold tabular-nums`. Nunca fonte serifada.
- Cores só por token (`bg-card`, `border-border`, `text-muted-foreground`, `text-primary`, `--chart-*`); cores literais apenas nas tonalidades semânticas já usadas (emerald/amber/red/sky/violet em 400–500).
- Idioma da UI: português do Brasil, sem emojis em rótulos (emojis permitidos só em textos de e-mail/WhatsApp).
- Verificação de tipos: o repo **não** passa `tsc` no baseline. Regra: `npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep -E "<arquivos tocados>"` deve retornar **apenas** erros que já existiam antes (checar com `git stash` → rodar → `git stash pop`). `npx eslint <arquivo>` não pode ter erros novos. `npm run build` deve passar.
- Nenhuma query por card: hooks recebem `leadIds[]` e fazem uma chamada com `.in(...)`.
- Commits pequenos, mensagem em português, trailer `Co-Authored-By: <modelo que implementou, ex.: Claude Sonnet 5> <noreply@anthropic.com>`. Antes de `git push`: `git pull -q --rebase origin main`.
- Sempre `cd /Volumes/nvme/minimal/Minimal-Cases-RevOS` antes de comandos (o cwd não persiste entre chamadas).
- **Novas nesta rodada:**
  - **Não tocar em nenhuma trava de envio.** Proibido editar `_shared/whatsapp-send-lock.ts`, o bloco "TRAVA DE ENVIO"/allowlist de `whatsapp-outbound`, o gate G2 `agent_requires_outreach` de `ai-agent-execute`, nem ler/gravar `sends_locked`/`test_allowlist`. Todo envio novo entra pelos caminhos existentes (`ai_scheduled_callbacks` → `ai-callback-worker` → `ai-agent-execute` → `whatsapp-outbound`).
  - Migrations em `supabase/migrations/` com nome `20260904HHMMSS_<slug>.sql`, **idempotentes** (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP POLICY IF EXISTS` antes de `CREATE POLICY`, `DO $$ … $$` para checks/publication/cron). Nunca `DROP TABLE`/`DROP COLUMN`. Não rodar migration nem deploy fora da Task 14.
  - Toda função pura nova em `supabase/functions/_shared/**` tem `*.test.ts` ao lado e roda com `deno test --allow-env --allow-net supabase/functions/_shared/<arquivo>.test.ts`. Toda função pura nova em `src/lib/**` tem `*.test.ts` com Vitest.
  - Deploy **só** das funções tocadas: `r`, `followup-trigger-worker`, `ai-agent-execute`, `yampi-process-event`, `ai-callback-worker`.
  - No caminho quente de `r` (antes do `302`): nenhuma query além da RPC, nenhum `import()` dinâmico, nenhum `await` de rede além da RPC.
  - Tabelas `tracked_links`, `tracked_link_clicks`, `yampi_*` não estão nos types gerados: use `const db = supabase as unknown as SupabaseClient` como os hooks existentes fazem.

---

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| Create `supabase/migrations/20260904100000_tracked_links_v2.sql` | Colunas de origem, `tracked_link_clicks`, RPC `record_tracked_click`, RLS, realtime, purge LGPD, colunas em `esteira_reconversions` |
| Create `supabase/migrations/20260904110000_esteira_agent_click_rule.sql` | Acrescenta regra sobre cliques ao prompt do agente seedado (idempotente) |
| Create `supabase/functions/_shared/click-classifier.ts` (+ `.test.ts`) | `classifyClick`, `deviceOf`, `extractClientIp`, `hashIp`, `clickInfoFromRequest` |
| Modify `supabase/functions/_shared/tracked-links.ts` | `createTrackedLinkDetailed`, `attachTrackedLinkMessage`, `trackedLinkBaseUrl`, `buildTrackedUrl`, `findTrackedClickBefore` |
| Create `supabase/functions/_shared/tracked-links-url.test.ts` | Testes de `buildTrackedUrl` |
| Create `supabase/functions/_shared/click-context.ts` (+ `.test.ts`) | `describeClicksForAgent`, `describeLinkOrigin`, `relativePt` |
| Create `supabase/functions/_shared/click-nudge.ts` (+ `.test.ts`) | `parseClickNudgeSettings`, `decideNudge` (puras) + `scheduleClickNudge` |
| Modify `supabase/functions/r/index.ts` | Classificação → RPC → 302 → `waitUntil` |
| Modify `supabase/functions/followup-trigger-worker/index.ts` | Origem nos links de WA/e-mail/SMS + attach à mensagem |
| Modify `supabase/functions/ai-agent-execute/index.ts` | Origem nos links das tools, attach no passo 10c, `{{contexto_cliques}}` |
| Modify `supabase/functions/yampi-process-event/index.ts` | Qual link converteu; cancela nudge pendente em evento de pagamento |
| Modify `supabase/functions/ai-callback-worker/index.ts` | `no_outreach_from_us` como no-op; guard de stage para `clique_sem_compra`; prompt do nudge |
| Modify `src/lib/esteira/queueSummary.ts` | `LeadQueueSummary.clicks` + `emptyQueueSummary()` |
| Create `src/lib/esteira/clicks.ts` (+ `.test.ts`) | `summarizeLinkClicks`, `clicksToTimeline`, `describeLinkOrigin` |
| Create `src/lib/bi/clicks.ts` (+ `.test.ts`) | `aggregateClickRates`, `overallClickRate` |
| Modify `src/lib/bi/reconversao.ts` | `Agregado.cliquesPorToque`, `Agregado.ctrGeral` |
| Modify `src/hooks/useEsteiraLead.ts` | Cliques no card e na timeline (`kind:'clique'`) |
| Create `src/hooks/useTrackedLinks.ts` | `useTrackedLinksByPerson`, `useTrackedClicksRealtime` |
| Modify `src/components/negocios/StageColumn.tsx` | Chip "Clicou" |
| Modify `src/components/negocios/NegocioEsteira.tsx` | Entrada de clique na timeline + realtime |
| Modify `src/components/conversas/ConversaDetalhes.tsx`, `src/components/negocios/conversa/MessageList.tsx` | "Link aberto HH:mm" na bolha |
| Modify `src/hooks/useReconversaoBI.ts`, `src/components/dashboard/BIProReconversaoTab.tsx`, `src/components/dashboard/reconversao/ReconversionsTable.tsx` · Create `src/components/dashboard/reconversao/ClickRateCard.tsx` | Taxa de clique por toque; "Clique · WA-01" na tabela |

**Ordem e paralelismo**

```
Task 0 (migration, só escrever)
  ├─ Grupo A (paralelo): Task 1 · Task 2 · Task 3 · Task 9
  ├─ Grupo B (paralelo, após A): Task 4 (1,2,3) · Task 5 (2) · Task 6 (2) · Task 7 (2) · Task 8 (—)
  ├─ Task 10 (após 9)
  ├─ Grupo C (paralelo, após 10): Task 11 · Task 12 · Task 13
  └─ Task 14 (migration + deploy + QA) — por último, um executor só
```

---

### Task 0: Migration — origem, eventos de clique, RPC, RLS, realtime, purge

**Files:**
- Create: `supabase/migrations/20260904100000_tracked_links_v2.sql`

**Interfaces:**
- Produces: colunas novas em `tracked_links`; tabela `tracked_link_clicks`; RPC `record_tracked_click(...)`; função `purge_tracked_click_pii()`; colunas `attributed_*` em `esteira_reconversions`.

- [ ] **Step 1: Escrever a migration** (conteúdo completo)

```sql
-- LINKS-V2 — Links rastreados: origem por toque, evento por clique, antibot, LGPD.
--
-- tracked_links       + source/label/template_name/followup_queue_id/message_id/execution_id/bot_hits/nudge_scheduled_at
-- tracked_link_clicks   1 linha por hit (humano ou robô). clicks/first/last_clicked_at de tracked_links
--                       passam a contar SÓ humano não duplicado (a RPC garante).
-- record_tracked_click  1 round-trip pro caminho quente da edge fn `r`.
-- purge_tracked_click_pii  apaga user_agent/ip_hash/referer com > 90 dias (pg_cron 03:17).
-- esteira_reconversions + attributed_link_id/source/template_name (qual toque converteu).

BEGIN;

-- ── tracked_links: origem ────────────────────────────────────────────────────
ALTER TABLE public.tracked_links
  ADD COLUMN IF NOT EXISTS source            text NOT NULL DEFAULT 'outro',
  ADD COLUMN IF NOT EXISTS label             text,
  ADD COLUMN IF NOT EXISTS template_name     text,
  ADD COLUMN IF NOT EXISTS followup_queue_id uuid REFERENCES public.followup_queue(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS message_id        bigint REFERENCES public.messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS execution_id      uuid,
  ADD COLUMN IF NOT EXISTS bot_hits          integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nudge_scheduled_at timestamptz;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tracked_links_source_check') THEN
    ALTER TABLE public.tracked_links ADD CONSTRAINT tracked_links_source_check
      CHECK (source = ANY (ARRAY['esteira_email','esteira_whatsapp','esteira_sms','agente','manual','outro']));
  END IF;
END $$;

COMMENT ON COLUMN public.tracked_links.source IS 'Quem criou o link: esteira_email | esteira_whatsapp | esteira_sms | agente | manual | outro (legado).';
COMMENT ON COLUMN public.tracked_links.label IS 'Slot do link: link_checkout | link_novo_checkout | wa_button_url | yampi_enviar_link_carrinho | yampi_enviar_link_pagamento | enviar_link_compra.';
COMMENT ON COLUMN public.tracked_links.template_name IS 'Nome do template Meta / template de e-mail / subject do toque que carregou o link.';
COMMENT ON COLUMN public.tracked_links.clicks IS 'Cliques HUMANOS não duplicados (robôs em bot_hits; detalhe em tracked_link_clicks).';

-- Legado: e-mail e SMS só nasciam da esteira. WhatsApp pode ser esteira ou agente → fica 'outro'.
UPDATE public.tracked_links SET source = 'esteira_email' WHERE source = 'outro' AND channel = 'email';
UPDATE public.tracked_links SET source = 'esteira_sms'   WHERE source = 'outro' AND channel = 'sms';

CREATE INDEX IF NOT EXISTS tracked_links_message_idx  ON public.tracked_links (message_id) WHERE message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS tracked_links_lead_idx     ON public.tracked_links (lead_id, created_at DESC) WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS tracked_links_fq_idx       ON public.tracked_links (followup_queue_id) WHERE followup_queue_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS tracked_links_created_idx  ON public.tracked_links (created_at DESC);

-- ── tracked_link_clicks: 1 linha por hit ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tracked_link_clicks (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tracked_link_id uuid NOT NULL REFERENCES public.tracked_links(id) ON DELETE CASCADE,
  lead_id         uuid,
  people_id       uuid,
  clicked_at      timestamptz NOT NULL DEFAULT now(),
  is_bot          boolean NOT NULL DEFAULT false,
  bot_reason      text,
  is_duplicate    boolean NOT NULL DEFAULT false,
  device          text,
  user_agent      text,
  ip_hash         text,
  referer         text
);
COMMENT ON TABLE public.tracked_link_clicks IS
  'Cada GET no link rastreado. is_bot=true (crawler de preview/scanner/prefetch) e is_duplicate=true (mesmo link+ip em <10s) NÃO contam em tracked_links.clicks. user_agent/ip_hash/referer são apagados após 90 dias (purge_tracked_click_pii). ip_hash = sha256(salt|dia|ip) — nunca IP puro.';

CREATE INDEX IF NOT EXISTS tlc_link_idx         ON public.tracked_link_clicks (tracked_link_id, clicked_at DESC);
CREATE INDEX IF NOT EXISTS tlc_lead_human_idx   ON public.tracked_link_clicks (lead_id, clicked_at DESC)   WHERE is_bot = false AND is_duplicate = false AND lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS tlc_people_human_idx ON public.tracked_link_clicks (people_id, clicked_at DESC) WHERE is_bot = false AND is_duplicate = false AND people_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS tlc_clicked_idx      ON public.tracked_link_clicks (clicked_at);

ALTER TABLE public.tracked_link_clicks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tracked_link_clicks_select_active_users ON public.tracked_link_clicks;
CREATE POLICY tracked_link_clicks_select_active_users ON public.tracked_link_clicks FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.settings_users su WHERE su.auth_user_id = auth.uid() AND su.active = true));
DROP POLICY IF EXISTS tracked_link_clicks_service_role ON public.tracked_link_clicks;
CREATE POLICY tracked_link_clicks_service_role ON public.tracked_link_clicks
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Realtime (INSERT de clique → kanban/inbox/BI sem F5). RLS de SELECT vale pro canal.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                 WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'tracked_link_clicks') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tracked_link_clicks;
  END IF;
END $$;

-- ── RPC: caminho quente do redirect (1 round-trip) ───────────────────────────
CREATE OR REPLACE FUNCTION public.record_tracked_click(
  p_token      text,
  p_is_bot     boolean,
  p_bot_reason text,
  p_user_agent text,
  p_ip_hash    text,
  p_referer    text,
  p_device     text
)
RETURNS TABLE (
  destination     text,
  lead_id         uuid,
  people_id       uuid,
  tracked_link_id uuid,
  counted         boolean,
  first_human     boolean,
  source          text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  l         public.tracked_links%ROWTYPE;
  v_dup     boolean := false;
  v_counted boolean := false;
  v_first   boolean := false;
BEGIN
  SELECT * INTO l FROM public.tracked_links t WHERE t.token = p_token;
  IF NOT FOUND THEN RETURN; END IF;

  IF NOT p_is_bot THEN
    -- Android: abre no navegador do WhatsApp e depois "abrir no Chrome" = 2 GETs em segundos.
    SELECT EXISTS (
      SELECT 1 FROM public.tracked_link_clicks c
      WHERE c.tracked_link_id = l.id AND c.is_bot = false AND c.is_duplicate = false
        AND c.ip_hash IS NOT DISTINCT FROM p_ip_hash
        AND c.clicked_at > now() - interval '10 seconds'
    ) INTO v_dup;
  END IF;

  INSERT INTO public.tracked_link_clicks
    (tracked_link_id, lead_id, people_id, is_bot, bot_reason, is_duplicate, device, user_agent, ip_hash, referer)
  VALUES
    (l.id, l.lead_id, l.people_id, p_is_bot, p_bot_reason, v_dup, p_device, left(p_user_agent, 512), p_ip_hash, left(p_referer, 512));

  IF p_is_bot THEN
    UPDATE public.tracked_links SET bot_hits = bot_hits + 1 WHERE id = l.id;
  ELSIF NOT v_dup THEN
    v_counted := true;
    v_first   := l.first_clicked_at IS NULL;
    UPDATE public.tracked_links
       SET clicks = clicks + 1,
           first_clicked_at = COALESCE(first_clicked_at, now()),
           last_clicked_at  = now()
     WHERE id = l.id;
  END IF;

  RETURN QUERY SELECT l.destination, l.lead_id, l.people_id, l.id, v_counted, v_first, l.source;
END;
$$;

REVOKE ALL ON FUNCTION public.record_tracked_click(text, boolean, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_tracked_click(text, boolean, text, text, text, text, text) TO service_role;
COMMENT ON FUNCTION public.record_tracked_click IS 'Edge fn r: registra o hit, conta só humano não duplicado e devolve destino/lead/pessoa em 1 chamada.';

-- ── LGPD: minimização — apaga UA/hash/referer com mais de 90 dias ────────────
CREATE OR REPLACE FUNCTION public.purge_tracked_click_pii()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.tracked_link_clicks
     SET user_agent = NULL, ip_hash = NULL, referer = NULL
   WHERE clicked_at < now() - interval '90 days'
     AND (user_agent IS NOT NULL OR ip_hash IS NOT NULL OR referer IS NOT NULL);
$$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'tracked-click-pii-purge') THEN
      PERFORM cron.unschedule('tracked-click-pii-purge');
    END IF;
    PERFORM cron.schedule('tracked-click-pii-purge', '17 3 * * *', $c$SELECT public.purge_tracked_click_pii();$c$);
  END IF;
END $$;

-- ── esteira_reconversions: qual link converteu ───────────────────────────────
ALTER TABLE public.esteira_reconversions
  ADD COLUMN IF NOT EXISTS attributed_link_id       uuid,
  ADD COLUMN IF NOT EXISTS attributed_link_source   text,
  ADD COLUMN IF NOT EXISTS attributed_template_name text;
COMMENT ON COLUMN public.esteira_reconversions.attributed_template_name IS
  'Quando attribution_level=clique: template/toque do link clicado antes do pagamento (ex.: minimal_esteira_wa01, "E2 · Celular voando").';

COMMIT;
```

- [ ] **Step 2: Validar sintaxe localmente sem aplicar**

Run: `cd /Volumes/nvme/minimal/Minimal-Cases-RevOS && supabase db lint 2>/dev/null | head -5; grep -c "IF NOT EXISTS\|OR REPLACE\|DROP POLICY IF EXISTS" supabase/migrations/20260904100000_tracked_links_v2.sql`
Expected: contagem ≥ 20. **Não** rodar `db push` aqui (Task 14).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260904100000_tracked_links_v2.sql
git commit -m "feat(links): migration v2 — origem por toque, tracked_link_clicks, RPC record_tracked_click, purge LGPD"
```

---

### Task 1: Classificador de clique (função pura + testes Deno)

**Files:**
- Create: `supabase/functions/_shared/click-classifier.ts`
- Create: `supabase/functions/_shared/click-classifier.test.ts`

**Interfaces:**
```ts
export interface ClickRequestInfo { method: string; userAgent: string | null; accept?: string | null; secPurpose?: string | null; purpose?: string | null; xPurpose?: string | null; xMoz?: string | null }
export type ClickDevice = 'mobile' | 'desktop' | 'unknown';
export type BotReason = 'method' | 'no_ua' | 'ua' | 'prefetch' | 'accept';
export interface ClickClass { isBot: boolean; reason: BotReason | null; device: ClickDevice }
export function classifyClick(req: ClickRequestInfo): ClickClass
export function deviceOf(ua: string | null): ClickDevice
export function clickInfoFromRequest(req: Request): ClickRequestInfo
export function extractClientIp(headers: Headers): string | null
export function hashIp(ip: string | null, salt: string, day?: string): Promise<string | null>
```

- [ ] **Step 1: Teste (falha)**

```ts
// supabase/functions/_shared/click-classifier.test.ts
// Run: deno test --allow-env supabase/functions/_shared/click-classifier.test.ts
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { classifyClick, deviceOf, extractClientIp, hashIp } from './click-classifier.ts';

const HTML = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8';
const get = (userAgent: string | null, extra: Partial<Parameters<typeof classifyClick>[0]> = {}) =>
  classifyClick({ method: 'GET', userAgent, accept: HTML, ...extra });

Deno.test('crawlers de preview são robôs (WhatsApp, Meta, Slack, Telegram, Twitter)', () => {
  for (const ua of [
    'WhatsApp/2.23.20.0 A',
    'WhatsApp/2.2338.12 W',
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    'meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)',
    'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
    'TelegramBot (like TwitterBot)',
    'Twitterbot/1.0',
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  ]) assertEquals(get(ua), { isBot: true, reason: 'ua', device: deviceOf(ua) }, ua);
});

Deno.test('scanners de e-mail e HTTP libs são robôs', () => {
  for (const ua of ['curl/8.4.0', 'python-requests/2.31', 'Go-http-client/2.0', 'Mozilla/5.0 (Windows NT 10.0) HeadlessChrome/118.0', 'Microsoft Office Word 2014', 'Barracuda Sentinel (EE)'])
    assertEquals(get(ua).isBot, true, ua);
});

Deno.test('navegadores reais são humanos — inclusive o navegador embutido do WhatsApp', () => {
  const android = 'Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.6367.54 Mobile Safari/537.36';
  const ios = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
  const desktop = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  assertEquals(get(android), { isBot: false, reason: null, device: 'mobile' });
  assertEquals(get(ios), { isBot: false, reason: null, device: 'mobile' });
  assertEquals(get(desktop), { isBot: false, reason: null, device: 'desktop' });
  // Sem header Accept (alguns webviews) continua humano.
  assertEquals(get(android, { accept: null }).isBot, false);
});

Deno.test('HEAD, UA vazio, prefetch e Accept sem text/html são robôs', () => {
  const ua = 'Mozilla/5.0 (Macintosh) Chrome/124 Safari/537.36';
  assertEquals(classifyClick({ method: 'HEAD', userAgent: ua, accept: HTML }).reason, 'method');
  assertEquals(get(null).reason, 'no_ua');
  assertEquals(get('   ').reason, 'no_ua');
  assertEquals(get(ua, { secPurpose: 'prefetch;prerender' }).reason, 'prefetch');
  assertEquals(get(ua, { xPurpose: 'preview' }).reason, 'prefetch');
  assertEquals(get(ua, { accept: '*/*' }).reason, 'accept');
});

Deno.test('extractClientIp prefere cf-connecting-ip > x-real-ip > primeiro x-forwarded-for', () => {
  assertEquals(extractClientIp(new Headers({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' })), '1.2.3.4');
  assertEquals(extractClientIp(new Headers({ 'x-real-ip': '5.6.7.8', 'x-forwarded-for': '1.2.3.4' })), '5.6.7.8');
  assertEquals(extractClientIp(new Headers()), null);
});

Deno.test('hashIp: 32 hex, determinístico no dia, muda com o dia, null sem IP', async () => {
  const a = await hashIp('1.2.3.4', 'salt', '2026-09-04');
  const b = await hashIp('1.2.3.4', 'salt', '2026-09-04');
  const c = await hashIp('1.2.3.4', 'salt', '2026-09-05');
  assertEquals(a, b);
  assertEquals(a === c, false);
  assertEquals(/^[0-9a-f]{32}$/.test(a!), true);
  assertEquals(await hashIp(null, 'salt'), null);
});
```

- [ ] **Step 2: Rodar** — `deno test --allow-env supabase/functions/_shared/click-classifier.test.ts` → falha (módulo inexistente).

- [ ] **Step 3: Implementar**

```ts
// supabase/functions/_shared/click-classifier.ts
/**
 * click-classifier — decide se um GET no link rastreado foi um humano ou um robô
 * (crawler de preview do WhatsApp/Meta/Slack, scanner de e-mail corporativo,
 * prefetch de navegador, HTTP lib). Função pura: recebe só método + headers.
 *
 * Importante: o navegador embutido do WhatsApp (Android/iOS) NÃO manda "WhatsApp"
 * no User-Agent — só o crawler de preview manda ("WhatsApp/2.23…"). Por isso a
 * palavra na regex é segura.
 */

export interface ClickRequestInfo {
  method: string;
  userAgent: string | null;
  accept?: string | null;
  secPurpose?: string | null;
  purpose?: string | null;
  xPurpose?: string | null;
  xMoz?: string | null;
}
export type ClickDevice = 'mobile' | 'desktop' | 'unknown';
export type BotReason = 'method' | 'no_ua' | 'ua' | 'prefetch' | 'accept';
export interface ClickClass { isBot: boolean; reason: BotReason | null; device: ClickDevice }

/** Lista explícita (sem `bot\b` genérico — "Cubot" é marca de celular). */
export const BOT_UA_RE = new RegExp(
  [
    // previews / redes sociais / mensageiros
    'whatsapp', 'facebookexternalhit', 'facebot', 'meta-external', 'twitterbot', 'slackbot', 'slack-imgproxy',
    'telegrambot', 'discordbot', 'linkedinbot', 'pinterestbot', 'skypeuripreview', 'iframely', 'embedly', 'linkpreview',
    // buscadores / crawlers
    'googlebot', 'google-inspectiontool', 'adsbot-google', 'bingbot', 'yandexbot', 'yandeximages', 'duckduckbot',
    'applebot', 'baiduspider', 'petalbot', 'bytespider', 'gptbot', 'claudebot', 'ccbot', 'amazonbot',
    'semrushbot', 'ahrefsbot', 'mj12bot', 'dotbot', 'ia_archiver',
    // http libs / headless
    'python-requests', 'python-urllib', 'aiohttp', 'go-http-client', 'okhttp', 'curl/', 'wget/', 'libwww-perl',
    'java/', 'apache-httpclient', 'node-fetch', 'undici', 'axios/', 'headlesschrome', 'phantomjs', 'puppeteer',
    'playwright', 'selenium', 'lighthouse',
    // monitoramento / segurança de e-mail
    'pingdom', 'uptimerobot', 'statuscake', 'site24x7', 'newrelicpinger', 'datadog',
    'barracuda', 'proofpoint', 'mimecast', 'forcepoint', 'safelinks', 'urldefense', 'trendmicro', 'symantec',
    'sophos', 'zscaler', 'microsoft office', 'ms-office', 'outlook-',
    // provedores de e-mail/marketing
    'klaviyo', 'sendgrid', 'mailgun', 'postmark', 'mailchimp', 'hubspot',
    // genéricos seguros
    'crawler', 'spider', 'scraper', 'scanner', 'validator',
  ].map((s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')).join('|'),
  'i',
);

export function deviceOf(ua: string | null): ClickDevice {
  if (!ua) return 'unknown';
  if (/mobile|android|iphone|ipad|ipod|windows phone/i.test(ua)) return 'mobile';
  if (/mozilla|windows nt|macintosh|x11|linux/i.test(ua)) return 'desktop';
  return 'unknown';
}

export function classifyClick(req: ClickRequestInfo): ClickClass {
  const ua = (req.userAgent ?? '').trim();
  const device = deviceOf(ua || null);
  if ((req.method ?? 'GET').toUpperCase() !== 'GET') return { isBot: true, reason: 'method', device };
  if (!ua) return { isBot: true, reason: 'no_ua', device };
  if (BOT_UA_RE.test(ua)) return { isBot: true, reason: 'ua', device };
  const purpose = [req.secPurpose, req.purpose, req.xPurpose, req.xMoz].filter(Boolean).join(' ').toLowerCase();
  if (/prefetch|preview|prerender/.test(purpose)) return { isBot: true, reason: 'prefetch', device };
  // Navegador em navegação de topo sempre manda text/html; scanner manda "*/*" ou nada.
  const accept = (req.accept ?? '').toLowerCase();
  if (accept && !accept.includes('text/html')) return { isBot: true, reason: 'accept', device };
  return { isBot: false, reason: null, device };
}

export function clickInfoFromRequest(req: Request): ClickRequestInfo {
  const h = req.headers;
  return {
    method: req.method,
    userAgent: h.get('user-agent'),
    accept: h.get('accept'),
    secPurpose: h.get('sec-purpose'),
    purpose: h.get('purpose'),
    xPurpose: h.get('x-purpose'),
    xMoz: h.get('x-moz'),
  };
}

export function extractClientIp(headers: Headers): string | null {
  const cf = headers.get('cf-connecting-ip');
  if (cf?.trim()) return cf.trim();
  const real = headers.get('x-real-ip');
  if (real?.trim()) return real.trim();
  const xff = headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim() || null;
  return null;
}

/** sha256(salt|dia|ip) truncado em 32 hex. Salt diário: não dá pra correlacionar entre dias. */
export async function hashIp(ip: string | null, salt: string, day = new Date().toISOString().slice(0, 10)): Promise<string | null> {
  if (!ip) return null;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}|${day}|${ip}`));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}
```

- [ ] **Step 4: Rodar** — `deno test --allow-env supabase/functions/_shared/click-classifier.test.ts` → 6 passed. Se algum UA da lista "humano" cair como bot, **corrija a regex**, não o teste.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/click-classifier.ts supabase/functions/_shared/click-classifier.test.ts
git commit -m "feat(links): classificador humano/robô do clique (função pura + testes)"
```

---

### Task 2: `tracked-links.ts` — link com origem, attach à mensagem, base configurável, qual link converteu

**Files:**
- Modify: `supabase/functions/_shared/tracked-links.ts`
- Create: `supabase/functions/_shared/tracked-links-url.test.ts`
- Create: `supabase/functions/_shared/click-context.ts`
- Create: `supabase/functions/_shared/click-context.test.ts`

**Interfaces:**
```ts
export type TrackedLinkSource = 'esteira_email' | 'esteira_whatsapp' | 'esteira_sms' | 'agente' | 'manual' | 'outro';
export interface CreateTrackedLinkOpts {
  destination: string; peopleId?: string | null; leadId?: string | null; channel?: string | null;
  source?: TrackedLinkSource; label?: string | null; templateName?: string | null;
  followupQueueId?: string | null; messageId?: number | null; executionId?: string | null;
}
export interface TrackedLinkCreated { id: string; token: string; url: string }
export function trackedLinkBaseUrl(): string                      // env TRACKED_LINK_BASE_URL ?? `${SUPABASE_URL}/functions/v1/r`
export function buildTrackedUrl(base: string, token: string): string
export async function createTrackedLinkDetailed(supabase, opts: CreateTrackedLinkOpts): Promise<TrackedLinkCreated | null>
export async function createTrackedLink(supabase, opts: CreateTrackedLinkOpts): Promise<string | null>   // wrapper (compat)
export async function attachTrackedLinkMessage(supabase, linkId: string, messageId: number): Promise<void>
export interface TrackedClickBefore { linkId: string; source: string; templateName: string | null; label: string | null; clickedAt: string }
export async function findTrackedClickBefore(supabase, peopleId, before: Date, windowDays: number): Promise<TrackedClickBefore | null>
export async function hadTrackedClickBefore(...)  // mantém, agora = !!findTrackedClickBefore
// click-context.ts
export interface ClickContextLink { source: string; label: string | null; template_name: string | null; channel: string | null; clicks: number; first_clicked_at: string | null; last_clicked_at: string | null }
export function describeLinkOrigin(l: Pick<ClickContextLink, 'source' | 'label' | 'template_name' | 'channel'>): string
export function relativePt(from: Date, now: Date): string
export function describeClicksForAgent(links: ClickContextLink[], now?: Date): string
```

- [ ] **Step 1: Testes (falham)**

```ts
// supabase/functions/_shared/tracked-links-url.test.ts
// Run: deno test --allow-env supabase/functions/_shared/tracked-links-url.test.ts
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildTrackedUrl } from './tracked-links.ts';

Deno.test('base terminada em /r usa query ?t= (compatível com os templates Meta aprovados)', () => {
  assertEquals(buildTrackedUrl('https://x.supabase.co/functions/v1/r', 'abc123XYZ0'), 'https://x.supabase.co/functions/v1/r?t=abc123XYZ0');
});
Deno.test('domínio curto usa path /<token>', () => {
  assertEquals(buildTrackedUrl('https://link.minimalcases.com.br', 'abc123XYZ0'), 'https://link.minimalcases.com.br/abc123XYZ0');
  assertEquals(buildTrackedUrl('https://link.minimalcases.com.br/', 'abc'), 'https://link.minimalcases.com.br/abc');
});
```

```ts
// supabase/functions/_shared/click-context.test.ts
// Run: deno test --allow-env supabase/functions/_shared/click-context.test.ts
import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { describeClicksForAgent, describeLinkOrigin, relativePt } from './click-context.ts';

const now = new Date('2026-09-04T01:00:00Z');

Deno.test('relativePt', () => {
  assertEquals(relativePt(new Date('2026-09-04T00:59:40Z'), now), 'agora');
  assertEquals(relativePt(new Date('2026-09-04T00:48:00Z'), now), 'há 12 min');
  assertEquals(relativePt(new Date('2026-09-03T22:00:00Z'), now), 'há 3 h');
  assertEquals(relativePt(new Date('2026-09-02T01:00:00Z'), now), 'há 2 dias');
});

Deno.test('describeLinkOrigin', () => {
  assertEquals(describeLinkOrigin({ source: 'esteira_whatsapp', label: 'wa_button_url', template_name: 'minimal_esteira_wa01', channel: 'whatsapp' }), 'WhatsApp · minimal_esteira_wa01');
  assertEquals(describeLinkOrigin({ source: 'esteira_email', label: 'link_checkout', template_name: 'E2 · Celular voando', channel: 'email' }), 'e-mail · E2 · Celular voando');
  assertEquals(describeLinkOrigin({ source: 'agente', label: 'yampi_enviar_link_pagamento', template_name: null, channel: 'whatsapp' }), 'agente · link de pagamento');
  assertEquals(describeLinkOrigin({ source: 'outro', label: null, template_name: null, channel: 'sms' }), 'SMS');
});

Deno.test('describeClicksForAgent: sem cliques', () => {
  assertEquals(describeClicksForAgent([], now), 'Cliques em links nossos: nenhum até agora.');
});

Deno.test('describeClicksForAgent: lista do mais recente, com contagem e tempo relativo', () => {
  const s = describeClicksForAgent([
    { source: 'esteira_whatsapp', label: 'wa_button_url', template_name: 'minimal_esteira_wa01', channel: 'whatsapp', clicks: 2, first_clicked_at: '2026-09-03T22:00:00Z', last_clicked_at: '2026-09-04T00:48:00Z' },
    { source: 'esteira_email', label: 'link_checkout', template_name: 'E1', channel: 'email', clicks: 1, first_clicked_at: '2026-09-02T01:00:00Z', last_clicked_at: '2026-09-02T01:00:00Z' },
  ], now);
  assertStringIncludes(s, 'abriu o link (WhatsApp · minimal_esteira_wa01) 2x, último há 12 min');
  assertStringIncludes(s, 'abriu o link (e-mail · E1) 1x há 2 dias');
  assertStringIncludes(s, 'já viu o carrinho');
});
```

- [ ] **Step 2: Rodar** — os dois `deno test` falham.

- [ ] **Step 3: Implementar em `tracked-links.ts`**

Substitua a função `createTrackedLink` atual (linhas ~24–41) por:

```ts
export type TrackedLinkSource = 'esteira_email' | 'esteira_whatsapp' | 'esteira_sms' | 'agente' | 'manual' | 'outro';

export interface CreateTrackedLinkOpts {
  destination: string;
  peopleId?: string | null;
  leadId?: string | null;
  channel?: string | null;
  /** Quem criou o link. Default 'outro' (legado). */
  source?: TrackedLinkSource;
  /** Slot: link_checkout | link_novo_checkout | wa_button_url | <nome da tool do agente>. */
  label?: string | null;
  /** Nome do template Meta / template de e-mail / subject do toque. */
  templateName?: string | null;
  followupQueueId?: string | null;
  messageId?: number | null;
  executionId?: string | null;
}

export interface TrackedLinkCreated { id: string; token: string; url: string }

/** Base pública do redirect. Domínio curto (decisão da cliente) entra por env sem tocar código. */
export function trackedLinkBaseUrl(): string {
  const custom = (Deno.env.get('TRACKED_LINK_BASE_URL') ?? '').trim().replace(/\/+$/, '');
  if (custom) return custom;
  return `${(Deno.env.get('SUPABASE_URL') ?? '').replace(/\/+$/, '')}/functions/v1/r`;
}

/** Base terminada em "/r" → "?t=<token>" (formato dos templates Meta aprovados); senão "/<token>". */
export function buildTrackedUrl(base: string, token: string): string {
  const b = base.replace(/\/+$/, '');
  return b.endsWith('/r') ? `${b}?t=${token}` : `${b}/${token}`;
}

export async function createTrackedLinkDetailed(
  supabase: SupabaseClient,
  opts: CreateTrackedLinkOpts,
): Promise<TrackedLinkCreated | null> {
  if (!opts.destination || !/^https?:\/\//i.test(opts.destination)) return null;
  const token = shortToken();
  const { data, error } = await supabase.from('tracked_links').insert({
    token,
    destination: opts.destination,
    people_id: opts.peopleId ?? null,
    lead_id: opts.leadId ?? null,
    channel: opts.channel ?? null,
    source: opts.source ?? 'outro',
    label: opts.label ?? null,
    template_name: opts.templateName ?? null,
    followup_queue_id: opts.followupQueueId ?? null,
    message_id: opts.messageId ?? null,
    execution_id: opts.executionId ?? null,
  }).select('id').single();
  if (error || !data) return null;
  return { id: (data as { id: string }).id, token, url: buildTrackedUrl(trackedLinkBaseUrl(), token) };
}

/** Compat: devolve só a URL. Prefira createTrackedLinkDetailed quando precisar do token/id. */
export async function createTrackedLink(supabase: SupabaseClient, opts: CreateTrackedLinkOpts): Promise<string | null> {
  return (await createTrackedLinkDetailed(supabase, opts))?.url ?? null;
}

/** Liga o link à linha de `messages` criada depois dele (template WA, botão do agente). */
export async function attachTrackedLinkMessage(supabase: SupabaseClient, linkId: string, messageId: number): Promise<void> {
  await supabase.from('tracked_links').update({ message_id: messageId }).eq('id', linkId).is('message_id', null);
}
```

E substitua `hadTrackedClickBefore` (fim do arquivo) por:

```ts
export interface TrackedClickBefore { linkId: string; source: string; templateName: string | null; label: string | null; clickedAt: string }

/** Link nosso mais recentemente clicado (humano) pela pessoa antes de `before`, dentro da janela. */
export async function findTrackedClickBefore(
  supabase: SupabaseClient,
  peopleId: string,
  before: Date,
  windowDays: number,
): Promise<TrackedClickBefore | null> {
  const windowStart = new Date(before.getTime() - windowDays * 86_400_000).toISOString();
  const { data } = await supabase
    .from('tracked_links')
    .select('id, source, template_name, label, last_clicked_at')
    .eq('people_id', peopleId)
    .gt('clicks', 0)
    .gte('last_clicked_at', windowStart)
    .lte('last_clicked_at', before.toISOString())
    .order('last_clicked_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const r = data as { id: string; source: string; template_name: string | null; label: string | null; last_clicked_at: string } | null;
  return r ? { linkId: r.id, source: r.source, templateName: r.template_name, label: r.label, clickedAt: r.last_clicked_at } : null;
}

/** true se a pessoa clicou em algum link rastreado nosso antes de `before`, dentro da janela. */
export async function hadTrackedClickBefore(supabase: SupabaseClient, peopleId: string, before: Date, windowDays: number): Promise<boolean> {
  return !!(await findTrackedClickBefore(supabase, peopleId, before, windowDays));
}
```

- [ ] **Step 4: Implementar `click-context.ts`**

```ts
// supabase/functions/_shared/click-context.ts
/** Texto curto, em pt-BR, dos cliques da pessoa em links nossos — injetado no prompt do agente. */

export interface ClickContextLink {
  source: string; label: string | null; template_name: string | null; channel: string | null;
  clicks: number; first_clicked_at: string | null; last_clicked_at: string | null;
}

const LABEL_PT: Record<string, string> = {
  link_checkout: 'link do carrinho',
  link_novo_checkout: 'link de novo checkout',
  wa_button_url: 'botão do template',
  yampi_enviar_link_carrinho: 'link do carrinho',
  yampi_enviar_link_pagamento: 'link de pagamento',
  enviar_link_compra: 'link de compra',
};
const CHANNEL_PT: Record<string, string> = { whatsapp: 'WhatsApp', email: 'e-mail', sms: 'SMS' };

export function describeLinkOrigin(l: Pick<ClickContextLink, 'source' | 'label' | 'template_name' | 'channel'>): string {
  if (l.source === 'agente') return `agente · ${LABEL_PT[l.label ?? ''] ?? 'link'}`;
  const canal = CHANNEL_PT[l.channel ?? ''] ?? (l.source === 'esteira_whatsapp' ? 'WhatsApp' : l.source === 'esteira_email' ? 'e-mail' : l.source === 'esteira_sms' ? 'SMS' : 'link');
  return l.template_name ? `${canal} · ${l.template_name}` : canal;
}

export function relativePt(from: Date, now: Date): string {
  const s = Math.max(0, Math.round((now.getTime() - from.getTime()) / 1000));
  if (s < 60) return 'agora';
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} dia${d === 1 ? '' : 's'}`;
}

export function describeClicksForAgent(links: ClickContextLink[], now = new Date()): string {
  const clicked = links.filter((l) => l.clicks > 0 && l.last_clicked_at)
    .sort((a, b) => (a.last_clicked_at! < b.last_clicked_at! ? 1 : -1)).slice(0, 3);
  if (clicked.length === 0) return 'Cliques em links nossos: nenhum até agora.';
  const partes = clicked.map((l) => {
    const rel = relativePt(new Date(l.last_clicked_at!), now);
    return `abriu o link (${describeLinkOrigin(l)}) ${l.clicks}x${l.clicks > 1 ? `, último ${rel}` : ` ${rel}`}`;
  });
  return `Cliques em links nossos: ${partes.join('; ')}. Se ainda não comprou, ele já viu o carrinho — pergunte o que travou em vez de só reenviar o link.`;
}
```

- [ ] **Step 5: Rodar** — `deno test --allow-env supabase/functions/_shared/tracked-links-url.test.ts supabase/functions/_shared/click-context.test.ts` → 6 passed. Também `deno check supabase/functions/_shared/tracked-links.ts`.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/_shared/tracked-links.ts supabase/functions/_shared/tracked-links-url.test.ts supabase/functions/_shared/click-context.ts supabase/functions/_shared/click-context.test.ts
git commit -m "feat(links): createTrackedLinkDetailed com origem, attach à mensagem, base configurável e contexto de cliques pro agente"
```

---

### Task 3: Agendamento do retorno reativo (`click-nudge.ts`)

**Files:**
- Create: `supabase/functions/_shared/click-nudge.ts`
- Create: `supabase/functions/_shared/click-nudge.test.ts`

**Interfaces:**
```ts
export interface ClickNudgeSettings { enabled: boolean; delayMinutes: number; templateName: string | null }
export function parseClickNudgeSettings(settings: unknown): ClickNudgeSettings          // pura; default enabled=false, 30 min
export const NUDGE_BLOCKED_STAGES: readonly string[]                                     // ['Pagamento pendente','Recuperado','Perdido']
export interface NudgeDecisionInput { settings: ClickNudgeSettings; leadId: string | null; peopleId: string | null; leadStatus: string | null; stageName: string | null; agentActive: boolean; lastNudgeAt: string | null; now: Date }
export function decideNudge(i: NudgeDecisionInput): { ok: true } | { ok: false; reason: string }   // pura
export function buildNudgeInstruction(delayMinutes: number): string                      // pura
export async function scheduleClickNudge(supabase, p: { linkId: string; leadId: string | null; peopleId: string | null }): Promise<{ scheduled: boolean; reason: string }>
```

Regras de `decideNudge` (todas precisam passar): `settings.enabled`; `leadId` e `peopleId` presentes; `leadStatus` ∉ {won, lost, archived}; `stageName` ∉ `NUDGE_BLOCKED_STAGES`; `agentActive`; `lastNudgeAt` nulo ou há mais de 24 h.

- [ ] **Step 1: Teste (falha)**

```ts
// supabase/functions/_shared/click-nudge.test.ts
// Run: deno test --allow-env supabase/functions/_shared/click-nudge.test.ts
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { decideNudge, parseClickNudgeSettings } from './click-nudge.ts';

Deno.test('parseClickNudgeSettings: padrão desligado, 30 min, sem template', () => {
  assertEquals(parseClickNudgeSettings(null), { enabled: false, delayMinutes: 30, templateName: null });
  assertEquals(parseClickNudgeSettings({ click_nudge_enabled: 'true', click_nudge_delay_minutes: '45', click_nudge_template_name: ' mc_clicou ' }),
    { enabled: true, delayMinutes: 45, templateName: 'mc_clicou' });
  assertEquals(parseClickNudgeSettings({ click_nudge_enabled: true, click_nudge_delay_minutes: 1 }).delayMinutes, 30); // < 5 min cai no default
});

const base = { settings: { enabled: true, delayMinutes: 30, templateName: null }, leadId: 'l', peopleId: 'p', leadStatus: 'open', stageName: 'Engajou', agentActive: true, lastNudgeAt: null, now: new Date('2026-09-04T01:00:00Z') };

Deno.test('decideNudge: ok no caso feliz', () => assertEquals(decideNudge(base), { ok: true }));
Deno.test('decideNudge: bloqueios', () => {
  assertEquals(decideNudge({ ...base, settings: { ...base.settings, enabled: false } }).ok, false);
  assertEquals(decideNudge({ ...base, leadId: null }).ok, false);
  assertEquals(decideNudge({ ...base, leadStatus: 'won' }).ok, false);
  assertEquals(decideNudge({ ...base, stageName: 'Pagamento pendente' }).ok, false);
  assertEquals(decideNudge({ ...base, stageName: 'Recuperado' }).ok, false);
  assertEquals(decideNudge({ ...base, agentActive: false }).ok, false);
  assertEquals(decideNudge({ ...base, lastNudgeAt: '2026-09-03T20:00:00Z' }).ok, false);   // < 24h
  assertEquals(decideNudge({ ...base, lastNudgeAt: '2026-09-02T20:00:00Z' }).ok, true);    // > 24h
});
```

- [ ] **Step 2: Rodar** → falha.

- [ ] **Step 3: Implementar**

```ts
// supabase/functions/_shared/click-nudge.ts
/**
 * click-nudge — "clicou e não comprou em X min → agente puxa conversa".
 *
 * NÃO envia nada. Só agenda uma linha em ai_scheduled_callbacks (mode 'agent',
 * reason 'clique_sem_compra'). Quem dispara é o ai-callback-worker, que já aplica:
 * ai_enabled, lead won/lost, conversa em andamento, janela de 24h do WhatsApp
 * (fora dela só template aprovado) e chama ai-agent-execute → whatsapp-outbound
 * (gate agent_requires_outreach, trava sends_locked, allowlist). Nenhuma trava
 * é lida ou alterada aqui.
 *
 * Config em omni_channel_configs.settings (channel='whatsapp'):
 *   click_nudge_enabled         false (padrão)  → nada é agendado
 *   click_nudge_delay_minutes   30
 *   click_nudge_template_name   null → fora da janela de 24h o worker marca 'failed'
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface ClickNudgeSettings { enabled: boolean; delayMinutes: number; templateName: string | null }

export function parseClickNudgeSettings(settings: unknown): ClickNudgeSettings {
  const s = (settings && typeof settings === 'object' ? settings : {}) as Record<string, unknown>;
  const enabled = s.click_nudge_enabled === true || s.click_nudge_enabled === 'true';
  const delayRaw = Number(s.click_nudge_delay_minutes ?? 30);
  const delayMinutes = Number.isFinite(delayRaw) && delayRaw >= 5 ? Math.floor(delayRaw) : 30;
  const tn = s.click_nudge_template_name;
  const templateName = typeof tn === 'string' && tn.trim() ? tn.trim() : null;
  return { enabled, delayMinutes, templateName };
}

export const NUDGE_BLOCKED_STAGES: readonly string[] = ['Pagamento pendente', 'Recuperado', 'Perdido'];

export interface NudgeDecisionInput {
  settings: ClickNudgeSettings; leadId: string | null; peopleId: string | null;
  leadStatus: string | null; stageName: string | null; agentActive: boolean; lastNudgeAt: string | null; now: Date;
}

export function decideNudge(i: NudgeDecisionInput): { ok: true } | { ok: false; reason: string } {
  if (!i.settings.enabled) return { ok: false, reason: 'click_nudge_enabled=false' };
  if (!i.leadId || !i.peopleId) return { ok: false, reason: 'link sem lead/pessoa' };
  if (['won', 'lost', 'archived'].includes(i.leadStatus ?? '')) return { ok: false, reason: `lead ${i.leadStatus}` };
  if (i.stageName && NUDGE_BLOCKED_STAGES.includes(i.stageName)) return { ok: false, reason: `stage ${i.stageName}` };
  if (!i.agentActive) return { ok: false, reason: 'sem agente ativo no pipeline' };
  if (i.lastNudgeAt && i.now.getTime() - new Date(i.lastNudgeAt).getTime() < 24 * 3_600_000) return { ok: false, reason: 'já houve nudge nas últimas 24h' };
  return { ok: true };
}

export function buildNudgeInstruction(delayMinutes: number): string {
  return `O cliente abriu o link do carrinho há ${delayMinutes} min e ainda não finalizou a compra. Puxe a conversa em 1 frase curta e humana, SEM reenviar o link de cara: pergunte se ficou alguma dúvida (encaixe no modelo, cor, frete, forma de pagamento). Se ele já escreveu depois do clique, só continue a conversa normalmente.`;
}

export async function scheduleClickNudge(
  supabase: SupabaseClient,
  p: { linkId: string; leadId: string | null; peopleId: string | null },
): Promise<{ scheduled: boolean; reason: string }> {
  const { data: cfg } = await supabase.from('omni_channel_configs').select('settings').eq('channel', 'whatsapp').maybeSingle();
  const settings = parseClickNudgeSettings((cfg as { settings?: unknown } | null)?.settings);
  if (!settings.enabled) return { scheduled: false, reason: 'click_nudge_enabled=false' };
  if (!p.leadId || !p.peopleId) return { scheduled: false, reason: 'link sem lead/pessoa' };

  const { data: leadRaw } = await supabase.from('leads').select('id, status, leads_stages_id, leads_pipelines_id').eq('id', p.leadId).maybeSingle();
  const lead = leadRaw as { status: string | null; leads_stages_id: string | null; leads_pipelines_id: string | null } | null;
  if (!lead) return { scheduled: false, reason: 'lead não encontrado' };

  let stageName: string | null = null;
  if (lead.leads_stages_id) {
    const { data: st } = await supabase.from('leads_stages').select('name').eq('id', lead.leads_stages_id).maybeSingle();
    stageName = (st as { name?: string } | null)?.name ?? null;
  }

  let agentActive = false;
  if (lead.leads_pipelines_id) {
    const { data: agents } = await supabase.from('ai_agents').select('id')
      .eq('active', true)
      .contains('channel_types', ['whatsapp'])
      .or(`pipeline_id.eq.${lead.leads_pipelines_id},pipeline_ids.cs.{${lead.leads_pipelines_id}}`)
      .limit(1);
    agentActive = ((agents ?? []) as unknown[]).length > 0;
  }

  const { data: lastNudge } = await supabase.from('tracked_links').select('nudge_scheduled_at')
    .eq('lead_id', p.leadId).not('nudge_scheduled_at', 'is', null)
    .order('nudge_scheduled_at', { ascending: false }).limit(1).maybeSingle();

  const now = new Date();
  const decision = decideNudge({
    settings, leadId: p.leadId, peopleId: p.peopleId, leadStatus: lead.status, stageName, agentActive,
    lastNudgeAt: (lastNudge as { nudge_scheduled_at?: string } | null)?.nudge_scheduled_at ?? null, now,
  });
  if (!decision.ok) return { scheduled: false, reason: decision.reason };

  const scheduledFor = new Date(now.getTime() + settings.delayMinutes * 60_000).toISOString();
  const { error } = await supabase.from('ai_scheduled_callbacks').insert({
    lead_id: p.leadId,
    people_id: p.peopleId,
    scheduled_for: scheduledFor,
    mode: 'agent',
    reason: 'clique_sem_compra',
    message_text: buildNudgeInstruction(settings.delayMinutes),
    whatsapp_template_name: settings.templateName,
    channel: 'whatsapp',
    status: 'pending',
  });
  // Índice único "1 pendente por lead": se o agente já agendou um retorno, deixamos o dele.
  if (error) return { scheduled: false, reason: `insert: ${error.message.slice(0, 120)}` };
  await supabase.from('tracked_links').update({ nudge_scheduled_at: now.toISOString() }).eq('id', p.linkId);
  return { scheduled: true, reason: `agendado para ${scheduledFor}` };
}
```

- [ ] **Step 4: Rodar** — `deno test --allow-env supabase/functions/_shared/click-nudge.test.ts` → 3 passed; `deno check supabase/functions/_shared/click-nudge.ts`.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/click-nudge.ts supabase/functions/_shared/click-nudge.test.ts
git commit -m "feat(links): agendamento do retorno reativo (clicou e não comprou) via ai_scheduled_callbacks — desligado por padrão"
```

---

### Task 4: Edge function `r` — classificar → RPC → 302 → background

**Files:**
- Modify: `supabase/functions/r/index.ts` (substituir o arquivo inteiro)

Depende de: Task 0 (RPC), Task 1, Task 2, Task 3.

- [ ] **Step 1: Substituir o conteúdo por**

```ts
/**
 * r — redirect rastreado (LINKS-V2). Público (verify_jwt=false).
 *
 * GET /functions/v1/r?t=<token>[?extra] →
 *   1. classifica a request (humano × crawler de preview/scanner/prefetch) — função pura;
 *   2. UMA chamada ao banco (rpc record_tracked_click): grava o hit em tracked_link_clicks,
 *      conta só humano não duplicado em tracked_links e devolve o destino;
 *   3. responde 302 imediatamente (robô inclusive — o preview precisa do redirect);
 *   4. em background (EdgeRuntime.waitUntil): move o lead para "Engajou" e, no PRIMEIRO
 *      clique humano, agenda o retorno reativo (se habilitado na config).
 * Token desconhecido → 302 para a loja. Nunca falha o redirect por causa do log.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { progressEsteiraStage } from '../_shared/esteira-progress.ts';
import { classifyClick, clickInfoFromRequest, extractClientIp, hashIp } from '../_shared/click-classifier.ts';
import { scheduleClickNudge } from '../_shared/click-nudge.ts';

const FALLBACK_URL = 'https://minimalcases.com.br/';

// Supabase Edge Runtime expõe EdgeRuntime.waitUntil (background tasks). Fallback: await.
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;
function runInBackground(p: Promise<unknown>): Promise<unknown> | null {
  const safe = p.catch(() => undefined);
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime && typeof EdgeRuntime.waitUntil === 'function') {
    EdgeRuntime.waitUntil(safe);
    return null;
  }
  return safe;
}

interface ClickResult {
  destination: string; lead_id: string | null; people_id: string | null;
  tracked_link_id: string; counted: boolean; first_human: boolean; source: string;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  // Templates anexam query ao {{link_checkout}} ("…?discount=VOLTA10&utm_…"), que
  // vira "r?t=TOKEN?discount=…" — o token é só o trecho até o primeiro '?', e
  // tudo o mais (inclusive outros params da URL) é repassado ao destino.
  const rawT = url.searchParams.get('t') ?? '';
  const [token, ...tailParts] = rawT.split('?');
  const extra = new URLSearchParams(tailParts.join('?'));
  for (const [k, v] of url.searchParams) if (k !== 't') extra.append(k, v);
  const extraQs = extra.toString();

  let destination = FALLBACK_URL;
  let background: Promise<unknown> | null = null;

  if (token && /^[A-Za-z0-9]{4,32}$/.test(token)) {
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );
      const cls = classifyClick(clickInfoFromRequest(req));
      const salt = Deno.env.get('TRACKED_LINKS_SALT') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'tracked-links';
      const ipHash = await hashIp(extractClientIp(req.headers), salt);

      const { data } = await supabase.rpc('record_tracked_click', {
        p_token: token,
        p_is_bot: cls.isBot,
        p_bot_reason: cls.reason,
        p_user_agent: (req.headers.get('user-agent') ?? '').slice(0, 512) || null,
        p_ip_hash: ipHash,
        p_referer: (req.headers.get('referer') ?? '').slice(0, 512) || null,
        p_device: cls.device,
      });
      const row = (Array.isArray(data) ? data[0] : data) as ClickResult | undefined;

      if (row?.destination) {
        destination = row.destination;
        if (row.counted) {
          background = runInBackground((async () => {
            // Progressão da esteira (YMP-7): clique humano = engajamento → "Engajou" (forward-only).
            if (row.lead_id) {
              try { await progressEsteiraStage(supabase, row.lead_id, 'Engajou'); } catch (_) { /* segue */ }
            }
            // Retorno reativo só no PRIMEIRO clique humano do link (config decide se agenda).
            if (row.first_human) {
              try { await scheduleClickNudge(supabase, { linkId: row.tracked_link_id, leadId: row.lead_id, peopleId: row.people_id }); } catch (_) { /* segue */ }
            }
          })());
        }
      }
    } catch (_) { /* redirect sempre acontece */ }
  }

  if (extraQs && destination !== FALLBACK_URL) {
    destination += (destination.includes('?') ? '&' : '?') + extraQs;
  }

  const res = new Response(null, {
    status: 302,
    headers: { 'Location': destination, 'Cache-Control': 'no-store' },
  });
  if (background) await background; // só quando não há waitUntil (ambiente local)
  return res;
});
```

- [ ] **Step 2: Verificar** — `deno check supabase/functions/r/index.ts`. Confirmar em `supabase/config.toml` que `[functions.r] verify_jwt = false` continua (não alterar).

- [ ] **Step 3: Teste local opcional** — `supabase functions serve r --no-verify-jwt --env-file supabase/.env.local` (se existir) e `curl -sI -A "WhatsApp/2.23.20.0 A" "http://localhost:54321/functions/v1/r?t=NAOEXISTE"` → `302` para a loja. Sem ambiente local, pular; QA real na Task 14.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/r/index.ts
git commit -m "feat(r): classifica humano/robô, 1 RPC antes do 302, progressão e nudge em background"
```

---

### Task 5: `followup-trigger-worker` — origem nos links da esteira + attach à mensagem

**Files:**
- Modify: `supabase/functions/followup-trigger-worker/index.ts`

Depende de: Task 2.

- [ ] **Step 1: Import** (linha 9) — trocar por:
```ts
import { createTrackedLink, createTrackedLinkDetailed, attachTrackedLinkMessage, resolveCartForPerson, resolvePendingPaymentForPerson, formatBRL } from "../_shared/tracked-links.ts";
```

- [ ] **Step 2: WhatsApp template** — dentro do bloco `if (entry.channel === 'whatsapp_template' && entry.template_id)`:
  - Logo **antes** de `if (entry.followup_id) {` (o que lê `waRule`, ~linha 293) declare: `let waLink: { id: string; token: string; url: string } | null = null;`
  - Substitua o bloco (~linhas 322–330):
```ts
              if (rv.wa_button_url && waCart?.url && entry.person_id) {
                const trackedWa = await createTrackedLink(supabase, {
                  destination: waCart.url, peopleId: entry.person_id, leadId: entry.lead_id, channel: 'whatsapp',
                });
                const tokenWa = trackedWa?.match(/[?&]t=([A-Za-z0-9]+)/)?.[1];
                if (tokenWa) {
                  msgComponents.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: tokenWa }] });
                }
              }
```
  por:
```ts
              if (rv.wa_button_url && waCart?.url && entry.person_id) {
                waLink = await createTrackedLinkDetailed(supabase, {
                  destination: waCart.url, peopleId: entry.person_id, leadId: entry.lead_id, channel: 'whatsapp',
                  source: 'esteira_whatsapp', label: 'wa_button_url', templateName: resolvedTemplateName, followupQueueId: entry.id,
                });
                // Botão URL do template: sufixo dinâmico = só o token (a base fixa está aprovada na Meta).
                if (waLink) {
                  msgComponents.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: waLink.token }] });
                }
              }
```
  - Logo **após** o `if (insertMsgError) { … }` (~linha 357) adicione:
```ts
          if (insertedMsg) {
            // Liga link ↔ mensagem (inbox mostra "link aberto") e fila ↔ mensagem (coluna já existia, nunca era preenchida).
            if (waLink) await attachTrackedLinkMessage(supabase, waLink.id, insertedMsg.id);
            await supabase.from('followup_queue').update({ message_id: insertedMsg.id }).eq('id', entry.id);
          }
```

- [ ] **Step 3: E-mail** — no bloco `if (rule?.email_template_id)` (~linha 431), troque `.select('subject, html_body, active')` por `.select('name, subject, html_body, active')` e, antes desse `if`, declare `let emailTemplateName: string | null = null;`; dentro, após `html = tpl.html_body ?? html;`, adicione `emailTemplateName = (tpl as { name?: string }).name ?? null;`. (Se `email_templates` não tiver coluna `name`, use `subject` — confirme com `grep -n "CREATE TABLE.*email_templates" -A15 supabase/migrations/*.sql`.)
  - `{{link_novo_checkout}}` (~linha 516): `createTrackedLink(supabase, { destination: pend.reorderUrl, peopleId: entry.person_id, leadId: entry.lead_id, channel: 'email', source: 'esteira_email', label: 'link_novo_checkout', templateName: emailTemplateName ?? subject, followupQueueId: entry.id })`.
  - `{{link_checkout}}` (~linha 525): idem com `label: 'link_checkout'`.

- [ ] **Step 4: SMS** (~linha 576): `createTrackedLink(supabase, { destination: cartUrl, peopleId: entry.person_id, leadId: entry.lead_id, channel: 'sms', source: 'esteira_sms', label: 'link_checkout', templateName: entry.subject ?? null, followupQueueId: entry.id })`.

- [ ] **Step 5: Verificar e commitar**

Run: `deno check supabase/functions/followup-trigger-worker/index.ts && grep -n "source: 'esteira_" supabase/functions/followup-trigger-worker/index.ts | wc -l` → 4.

```bash
git add supabase/functions/followup-trigger-worker/index.ts
git commit -m "feat(esteira): links com origem (regra, template, mensagem) nos toques de WhatsApp, e-mail e SMS"
```

---

### Task 6: `ai-agent-execute` — origem nos links das tools, attach no envio, `{{contexto_cliques}}`

**Files:**
- Modify: `supabase/functions/ai-agent-execute/index.ts`
- Create: `supabase/migrations/20260904110000_esteira_agent_click_rule.sql`

Depende de: Task 2.

- [ ] **Step 1: Tipo do contexto** — na interface do contexto (~linhas 96–139), após `remetente: string;` adicione `contexto_cliques: string;`.

- [ ] **Step 2: Injeção no contexto** — no bloco EST-AGENT (~linha 1147), após `ctx.remetente = 'Minimal Cases';` adicione `ctx.contexto_cliques = 'Cliques em links nossos: nenhum até agora.';`. Dentro do `try`, **depois** de `if (linhas.length > 0) ctx.contexto_loja = linhas.join('\n');` e ainda dentro do `if (ctx.pessoa_id) { … }`, adicione:

```ts
      // LINKS-V2: o agente sabe se a pessoa abriu algum link nosso (e qual) — evita reenviar o link
      // pra quem já viu o carrinho e permite perguntar o que travou.
      const { data: clickLinks } = await supabase
        .from('tracked_links')
        .select('source, label, template_name, channel, clicks, first_clicked_at, last_clicked_at')
        .eq('people_id', ctx.pessoa_id)
        .gt('clicks', 0)
        .order('last_clicked_at', { ascending: false })
        .limit(3);
      const { describeClicksForAgent } = await import('../_shared/click-context.ts');
      ctx.contexto_cliques = describeClicksForAgent((clickLinks ?? []) as never, new Date());
      ctx.contexto_loja = `${ctx.contexto_loja}\n${ctx.contexto_cliques}`;
```
  (O prompt seedado imprime `{{contexto_loja}}`; anexar ali faz o agente enxergar sem editar o `input_data`. `{{contexto_cliques}}` fica disponível para prompts que queiram só isso.)

- [ ] **Step 3: Tools** — nos três pontos que criam link:
  - `enviar_link_compra` (~linha 2400–2411): hoje `ctx.__pending_purchase_url = url` sem rastrear. Envolva: 
```ts
        const { createTrackedLinkDetailed } = await import('../_shared/tracked-links.ts');
        const trackedCompra = await createTrackedLinkDetailed(supabase as never, { destination: url, peopleId: ctx.pessoa_id, leadId, channel: 'whatsapp', source: 'agente', label: 'enviar_link_compra', executionId: ctx.__execution_id || null });
        ctx.__pending_purchase_url = trackedCompra?.url ?? url;
        ctx.__pending_purchase_link_id = trackedCompra?.id ?? '';
```
  - `yampi_enviar_link_carrinho` (~linhas 2495–2499) e `yampi_enviar_link_pagamento` (~linhas 2625–2629): troque `createTrackedLink` por `createTrackedLinkDetailed` com `source: 'agente', label: '<nome da tool>', executionId: ctx.__execution_id || null`; `ctx.__pending_purchase_url = tracked?.url ?? url` e `ctx.__pending_purchase_link_id = tracked?.id ?? ''`.
  - `ctx.__execution_id`: logo após o ponto onde `executionId` recebe valor (grep `executionId = ` dentro de `Deno.serve`), adicione `ctx.__execution_id = executionId ?? '';` (o ctx tem index signature `[key: string]: string`). Se as tools recebem `executionId` por parâmetro, use-o direto.

- [ ] **Step 4: Passo 10c** (~linha 4014) — troque `const { error: purchaseInsertError } = await supabase.from('messages').insert({…});` por `const { data: purchaseInserted, error: purchaseInsertError } = await supabase.from('messages').insert({…}).select('id').single();` e, no ramo de sucesso (`else { log.info('purchase_url_sent', …) }`), adicione:
```ts
        const linkId = ctx.__pending_purchase_link_id;
        const msgId = (purchaseInserted as { id?: number } | null)?.id;
        if (linkId && msgId) {
          const { attachTrackedLinkMessage } = await import('../_shared/tracked-links.ts');
          await attachTrackedLinkMessage(supabase as never, linkId, msgId);
        }
```

- [ ] **Step 5: Regra no prompt do agente seedado** (idempotente):

```sql
-- supabase/migrations/20260904110000_esteira_agent_click_rule.sql
-- LINKS-V2: o contexto passa a trazer "Cliques em links nossos: …". Regra curta pro agente usar isso.
UPDATE public.ai_agents
   SET general_rules = general_rules || E'\n- CLIQUES: se o CONTEXTO diz que ele já abriu o link e não comprou, não reenvie o link de cara — pergunte em 1 frase o que travou (modelo, cor, frete, pagamento) e só então ofereça o link.'
 WHERE name = 'Minimal · Recuperação WhatsApp'
   AND general_rules NOT LIKE '%CLIQUES:%';
```

- [ ] **Step 6: Verificar e commitar**

Run: `deno check supabase/functions/ai-agent-execute/index.ts && deno test --allow-net --allow-env supabase/functions/ai-agent-execute/index.test.ts`

```bash
git add supabase/functions/ai-agent-execute/index.ts supabase/migrations/20260904110000_esteira_agent_click_rule.sql
git commit -m "feat(agente): links das tools com origem/execução, ligação à mensagem enviada e contexto de cliques no prompt"
```

---

### Task 7: `yampi-process-event` — qual link converteu + cancela nudge em evento de pagamento

**Files:**
- Modify: `supabase/functions/yampi-process-event/index.ts`

Depende de: Task 0 (colunas), Task 2.

- [ ] **Step 1: Import** (linha 27): `import { findTrackedClickBefore } from '../_shared/tracked-links.ts';`

- [ ] **Step 2: Atribuição** (~linha 399): substitua
```ts
        const clicked = isOurCoupon ? false : await hadTrackedClickBefore(supabase, peopleId, paidAt, WINDOW_DAYS);
```
por
```ts
        const clickBefore = isOurCoupon ? null : await findTrackedClickBefore(supabase, peopleId, paidAt, WINDOW_DAYS);
        const clicked = !!clickBefore;
```
e no `upsert` de `esteira_reconversions` acrescente:
```ts
          attributed_link_id: clickBefore?.linkId ?? null,
          attributed_link_source: clickBefore?.source ?? null,
          attributed_template_name: clickBefore?.templateName ?? clickBefore?.label ?? null,
```

- [ ] **Step 3: Cancelar nudge pendente** — logo após o bloco "Fim da esteira" (~linhas 336–346), adicione (não altere o cancelamento de `followup_queue` existente):

```ts
    // LINKS-V2: qualquer sinal de pagamento em andamento/concluído cancela o retorno reativo
    // "clicou e não comprou" que ainda não disparou.
    if (['pix_gerado', 'boleto_gerado', 'pedido_criado', 'pedido_pago', 'pedido_cancelado'].includes(trigger) && leadId) {
      const { error: nudgeErr } = await supabase
        .from('ai_scheduled_callbacks')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancel_reason: `auto-cancel: ${trigger}` })
        .eq('lead_id', leadId)
        .eq('status', 'pending')
        .eq('reason', 'clique_sem_compra');
      if (!nudgeErr) log.info('click_nudge_cancelled', { lead_id: leadId, trigger });
    }
```

- [ ] **Step 4: Verificar e commitar**

Run: `deno check supabase/functions/yampi-process-event/index.ts`

```bash
git add supabase/functions/yampi-process-event/index.ts
git commit -m "feat(bi): reconversão guarda qual link/toque converteu; evento de pagamento cancela nudge pendente"
```

---

### Task 8: `ai-callback-worker` — no-op correto, guard de stage e prompt do nudge

**Files:**
- Modify: `supabase/functions/ai-callback-worker/index.ts`

Independente (pode rodar em paralelo com o Grupo B).

- [ ] **Step 1: Bug lateral** — em `NO_OP_STATUSES` (~linha 370) acrescente `'no_outreach_from_us'` (hoje um `200 {status:'no_outreach_from_us'}` do gate G2 vira `sent`).

- [ ] **Step 2: Guard de stage para o nudge** — em `processCallback`, após o guard `if (leadStatus === 'won' || leadStatus === 'lost') { … }` (~linha 253), adicione:

```ts
  // LINKS-V2: retorno reativo "clicou e não comprou" — não incomoda quem já está pagando/pagou/perdeu.
  if (row.reason === 'clique_sem_compra') {
    const { data: leadStageRow } = await supabase.from('leads').select('leads_stages_id').eq('id', row.lead_id).maybeSingle();
    const stageId = (leadStageRow as { leads_stages_id?: string | null } | null)?.leads_stages_id ?? null;
    if (stageId) {
      const { data: st } = await supabase.from('leads_stages').select('name').eq('id', stageId).maybeSingle();
      const stageName = String((st as { name?: string } | null)?.name ?? '');
      if (['Pagamento pendente', 'Recuperado', 'Perdido'].includes(stageName)) {
        return finish({ status: 'skipped', error_message: `clique_sem_compra: lead em "${stageName}"` }, 'skipped');
      }
    }
  }
```

- [ ] **Step 3: Prompt do nudge** — no ramo `decision.kind === 'agent'` (~linha 356), troque
```ts
          direct_message: buildAgentDirectMessage(row.reason, content.freePrompt),
```
por
```ts
          // Nudge de clique não tem agent/step config: a instrução vem em message_text.
          direct_message: buildAgentDirectMessage(row.reason, content.freePrompt ?? (row.reason === 'clique_sem_compra' ? row.message_text : null)),
```

- [ ] **Step 4: Verificar e commitar**

Run: `deno check supabase/functions/ai-callback-worker/index.ts && deno test --allow-env --allow-net supabase/functions/ai-callback-worker/logic.test.ts`

```bash
git add supabase/functions/ai-callback-worker/index.ts
git commit -m "fix(callback): no_outreach_from_us é no-op; guard de stage e instrução do retorno por clique"
```

---

### Task 9: Funções puras do front — cliques por lead, timeline, CTR por toque

**Files:**
- Modify: `src/lib/esteira/queueSummary.ts`
- Create: `src/lib/esteira/clicks.ts`, `src/lib/esteira/clicks.test.ts`
- Create: `src/lib/bi/clicks.ts`, `src/lib/bi/clicks.test.ts`
- Modify: `src/lib/bi/reconversao.ts`
- Modify: `src/hooks/useEsteiraLead.ts` (**só** o tipo `TimelineEntry.kind`)

**Interfaces:**
```ts
// queueSummary.ts
export interface LeadClickSummary { total: number; links: number; firstAt: string | null; lastAt: string | null }
export interface LeadQueueSummary { …existente…; clicks: LeadClickSummary }
export function emptyQueueSummary(): LeadQueueSummary
// esteira/clicks.ts
export interface TrackedLinkRow { id: string; lead_id: string | null; people_id?: string | null; source: string; label: string | null; template_name: string | null; channel: string | null; clicks: number; first_clicked_at: string | null; last_clicked_at: string | null; message_id?: number | null; created_at?: string }
export interface TrackedClickRow { id: number; tracked_link_id: string; lead_id: string | null; clicked_at: string; device: string | null }
export function describeLinkOrigin(l: Pick<TrackedLinkRow, 'source' | 'label' | 'template_name' | 'channel'>): string
export function summarizeLinkClicks(links: TrackedLinkRow[]): Record<string, LeadClickSummary>
export function clicksToTimeline(links: TrackedLinkRow[], clicks: TrackedClickRow[]): TimelineEntry[]
// bi/clicks.ts
export interface ClickRateRow { key: string; source: string; label: string; enviados: number; clicados: number; cliques: number; ctr: number | null }
export function aggregateClickRates(links: Array<Pick<TrackedLinkRow, 'source' | 'label' | 'template_name' | 'channel' | 'clicks'>>): ClickRateRow[]
export function overallClickRate(links: Array<Pick<TrackedLinkRow, 'clicks'>>): { enviados: number; clicados: number; ctr: number | null }
```

- [ ] **Step 1: `TimelineEntry.kind`** — em `src/hooks/useEsteiraLead.ts` troque `kind: 'evento' | 'toque';` por `kind: 'evento' | 'toque' | 'clique';`.

- [ ] **Step 2: `queueSummary.ts`** — adicione o tipo `LeadClickSummary`, o campo `clicks` em `LeadQueueSummary`, e exporte `emptyQueueSummary`:
```ts
export interface LeadClickSummary { total: number; links: number; firstAt: string | null; lastAt: string | null }
export interface LeadQueueSummary {
  sent: Record<Channel, number> & { total: number };
  pending: number; failed: number; cancelled: number; total: number;
  nextAt: string | null; nextChannel: Channel | null; nextLabel: string | null;
  clicks: LeadClickSummary;
}
export function emptyQueueSummary(): LeadQueueSummary {
  return { sent: { email: 0, whatsapp: 0, sms: 0, total: 0 }, pending: 0, failed: 0, cancelled: 0, total: 0, nextAt: null, nextChannel: null, nextLabel: null, clicks: { total: 0, links: 0, firstAt: null, lastAt: null } };
}
```
Troque as chamadas internas de `empty()` por `emptyQueueSummary()` (remova `empty`). Rode `npm test` — os testes existentes de `queueSummary` continuam passando (usam `toEqual` em `sent` e `toMatchObject`).

- [ ] **Step 3: Testes (falham)**

```ts
// src/lib/esteira/clicks.test.ts
import { describe, expect, it } from 'vitest';
import { clicksToTimeline, describeLinkOrigin, summarizeLinkClicks, type TrackedLinkRow } from './clicks';

const links: TrackedLinkRow[] = [
  { id: 'L1', lead_id: 'a', source: 'esteira_whatsapp', label: 'wa_button_url', template_name: 'minimal_esteira_wa01', channel: 'whatsapp', clicks: 2, first_clicked_at: '2026-09-03T22:31:00Z', last_clicked_at: '2026-09-04T00:48:00Z' },
  { id: 'L2', lead_id: 'a', source: 'esteira_email', label: 'link_checkout', template_name: 'E1', channel: 'email', clicks: 0, first_clicked_at: null, last_clicked_at: null },
  { id: 'L3', lead_id: 'b', source: 'agente', label: 'yampi_enviar_link_pagamento', template_name: null, channel: 'whatsapp', clicks: 1, first_clicked_at: '2026-09-01T10:00:00Z', last_clicked_at: '2026-09-01T10:00:00Z' },
];

describe('summarizeLinkClicks', () => {
  it('soma cliques humanos por lead e acha primeiro/último', () => {
    const s = summarizeLinkClicks(links);
    expect(s['a']).toEqual({ total: 2, links: 1, firstAt: '2026-09-03T22:31:00Z', lastAt: '2026-09-04T00:48:00Z' });
    expect(s['b'].total).toBe(1);
  });
  it('lead sem clique não aparece', () => {
    expect(summarizeLinkClicks(links.filter((l) => l.id === 'L2'))).toEqual({});
  });
});

describe('describeLinkOrigin', () => {
  it('nomeia canal e template', () => {
    expect(describeLinkOrigin(links[0])).toBe('WhatsApp · minimal_esteira_wa01');
    expect(describeLinkOrigin(links[2])).toBe('Agente · link de pagamento');
  });
});

describe('clicksToTimeline', () => {
  it('uma entrada por clique humano, com ordinal e dispositivo', () => {
    const t = clicksToTimeline(links, [
      { id: 1, tracked_link_id: 'L1', lead_id: 'a', clicked_at: '2026-09-03T22:31:00Z', device: 'mobile' },
      { id: 2, tracked_link_id: 'L1', lead_id: 'a', clicked_at: '2026-09-04T00:48:00Z', device: 'desktop' },
    ]);
    expect(t).toHaveLength(2);
    expect(t[0]).toMatchObject({ id: 'click-1', kind: 'clique', type: 'whatsapp', title: 'Abriu o link · WhatsApp · minimal_esteira_wa01', detail: 'celular' });
    expect(t[1].detail).toBe('2º clique · computador');
  });
  it('link legado com clicks>0 e sem eventos vira uma entrada em first_clicked_at', () => {
    const t = clicksToTimeline(links, []);
    expect(t.map((e) => e.id).sort()).toEqual(['click-legacy-L1', 'click-legacy-L3']);
    expect(t.find((e) => e.id === 'click-legacy-L1')?.detail).toBe('2 cliques');
  });
});
```

```ts
// src/lib/bi/clicks.test.ts
import { describe, expect, it } from 'vitest';
import { aggregateClickRates, overallClickRate } from './clicks';

const links = [
  { source: 'esteira_whatsapp', label: 'wa_button_url', template_name: 'minimal_esteira_wa01', channel: 'whatsapp', clicks: 2 },
  { source: 'esteira_whatsapp', label: 'wa_button_url', template_name: 'minimal_esteira_wa01', channel: 'whatsapp', clicks: 0 },
  { source: 'esteira_whatsapp', label: 'wa_button_url', template_name: 'minimal_esteira_wa01', channel: 'whatsapp', clicks: 1 },
  { source: 'esteira_email', label: 'link_checkout', template_name: 'E1', channel: 'email', clicks: 0 },
  { source: 'agente', label: 'yampi_enviar_link_carrinho', template_name: null, channel: 'whatsapp', clicks: 1 },
];

describe('aggregateClickRates', () => {
  it('agrupa por origem+template, ordena por enviados, calcula CTR', () => {
    const r = aggregateClickRates(links);
    expect(r[0]).toEqual({ key: 'esteira_whatsapp|minimal_esteira_wa01', source: 'esteira_whatsapp', label: 'WhatsApp · minimal_esteira_wa01', enviados: 3, clicados: 2, cliques: 3, ctr: 2 / 3 });
    expect(r.find((x) => x.source === 'esteira_email')?.ctr).toBe(0);
    expect(r.find((x) => x.source === 'agente')?.label).toBe('Agente · link do carrinho');
  });
  it('lista vazia → [] e CTR geral null', () => {
    expect(aggregateClickRates([])).toEqual([]);
    expect(overallClickRate([])).toEqual({ enviados: 0, clicados: 0, ctr: null });
    expect(overallClickRate(links)).toEqual({ enviados: 5, clicados: 3, ctr: 0.6 });
  });
});
```

- [ ] **Step 4: Rodar** — `npm test` → falham os novos.

- [ ] **Step 5: Implementar `src/lib/esteira/clicks.ts`**

```ts
/**
 * clicks — cliques em links rastreados por lead (card do kanban) e como entradas
 * da timeline da esteira. Puro; os hooks só passam as linhas do banco.
 */
import type { TimelineEntry } from '@/hooks/useEsteiraLead';
import type { LeadClickSummary } from './queueSummary';

export interface TrackedLinkRow {
  id: string; lead_id: string | null; people_id?: string | null;
  source: string; label: string | null; template_name: string | null; channel: string | null;
  clicks: number; first_clicked_at: string | null; last_clicked_at: string | null;
  message_id?: number | null; created_at?: string;
}
export interface TrackedClickRow { id: number; tracked_link_id: string; lead_id: string | null; clicked_at: string; device: string | null }

const LABEL_PT: Record<string, string> = {
  link_checkout: 'link do carrinho', link_novo_checkout: 'link de novo checkout', wa_button_url: 'botão do template',
  yampi_enviar_link_carrinho: 'link do carrinho', yampi_enviar_link_pagamento: 'link de pagamento', enviar_link_compra: 'link de compra',
};
const CHANNEL_PT: Record<string, string> = { whatsapp: 'WhatsApp', email: 'E-mail', sms: 'SMS' };
const DEVICE_PT: Record<string, string> = { mobile: 'celular', desktop: 'computador' };

export function describeLinkOrigin(l: Pick<TrackedLinkRow, 'source' | 'label' | 'template_name' | 'channel'>): string {
  if (l.source === 'agente') return `Agente · ${LABEL_PT[l.label ?? ''] ?? 'link'}`;
  const canal = CHANNEL_PT[l.channel ?? ''] ?? (l.source === 'esteira_whatsapp' ? 'WhatsApp' : l.source === 'esteira_email' ? 'E-mail' : l.source === 'esteira_sms' ? 'SMS' : 'Link');
  return l.template_name ? `${canal} · ${l.template_name}` : canal;
}

export function summarizeLinkClicks(links: TrackedLinkRow[]): Record<string, LeadClickSummary> {
  const out: Record<string, LeadClickSummary> = {};
  for (const l of links) {
    if (!l.lead_id || l.clicks <= 0) continue;
    const s = (out[l.lead_id] ??= { total: 0, links: 0, firstAt: null, lastAt: null });
    s.total += l.clicks; s.links++;
    if (l.first_clicked_at && (!s.firstAt || l.first_clicked_at < s.firstAt)) s.firstAt = l.first_clicked_at;
    if (l.last_clicked_at && (!s.lastAt || l.last_clicked_at > s.lastAt)) s.lastAt = l.last_clicked_at;
  }
  return out;
}

const ordinal = (n: number) => `${n}º clique`;

export function clicksToTimeline(links: TrackedLinkRow[], clicks: TrackedClickRow[]): TimelineEntry[] {
  const byId = new Map(links.map((l) => [l.id, l]));
  const out: TimelineEntry[] = [];
  const perLink = new Map<string, number>();
  const sorted = [...clicks].sort((a, b) => (a.clicked_at < b.clicked_at ? -1 : 1));
  for (const c of sorted) {
    const link = byId.get(c.tracked_link_id);
    if (!link) continue;
    const n = (perLink.get(link.id) ?? 0) + 1;
    perLink.set(link.id, n);
    const dev = DEVICE_PT[c.device ?? ''] ?? null;
    const detail = [n > 1 ? ordinal(n) : null, dev].filter(Boolean).join(' · ') || undefined;
    out.push({ id: `click-${c.id}`, at: c.clicked_at, kind: 'clique', type: link.channel ?? link.source, title: `Abriu o link · ${describeLinkOrigin(link)}`, detail });
  }
  // Links anteriores à tabela de eventos: uma entrada no primeiro clique.
  for (const l of links) {
    if (l.clicks > 0 && l.first_clicked_at && !perLink.has(l.id)) {
      out.push({ id: `click-legacy-${l.id}`, at: l.first_clicked_at, kind: 'clique', type: l.channel ?? l.source, title: `Abriu o link · ${describeLinkOrigin(l)}`, detail: l.clicks > 1 ? `${l.clicks} cliques` : undefined });
    }
  }
  return out;
}
```

- [ ] **Step 6: Implementar `src/lib/bi/clicks.ts`**

```ts
/** CTR por toque: links criados no período agrupados por origem + template. Puro. */
import { describeLinkOrigin, type TrackedLinkRow } from '@/lib/esteira/clicks';

export interface ClickRateRow { key: string; source: string; label: string; enviados: number; clicados: number; cliques: number; ctr: number | null }
type L = Pick<TrackedLinkRow, 'source' | 'label' | 'template_name' | 'channel' | 'clicks'>;

export function aggregateClickRates(links: L[]): ClickRateRow[] {
  const map = new Map<string, ClickRateRow>();
  for (const l of links) {
    const key = `${l.source}|${l.template_name ?? l.label ?? l.channel ?? '-'}`;
    const row = map.get(key) ?? { key, source: l.source, label: describeLinkOrigin(l), enviados: 0, clicados: 0, cliques: 0, ctr: null };
    row.enviados++; row.cliques += l.clicks; if (l.clicks > 0) row.clicados++;
    map.set(key, row);
  }
  return [...map.values()].map((r) => ({ ...r, ctr: r.enviados ? r.clicados / r.enviados : null })).sort((a, b) => b.enviados - a.enviados);
}

export function overallClickRate(links: Array<Pick<TrackedLinkRow, 'clicks'>>): { enviados: number; clicados: number; ctr: number | null } {
  const enviados = links.length;
  const clicados = links.filter((l) => l.clicks > 0).length;
  return { enviados, clicados, ctr: enviados ? clicados / enviados : null };
}
```

- [ ] **Step 7: `reconversao.ts`** — em `Agregado` adicione `cliquesPorToque: ClickRateRow[]; ctrGeral: { enviados: number; clicados: number; ctr: number | null };`. Em `aggregateReconversao`, aceite `links?: Parameters<typeof aggregateClickRates>[0]` no input (opcional, default `[]`) e devolva `cliquesPorToque: aggregateClickRates(links ?? [])`, `ctrGeral: overallClickRate(links ?? [])`. Importe de `./clicks`. Os testes existentes de `reconversao.test.ts` seguem passando (campo novo, input opcional).

- [ ] **Step 8: Rodar e commitar**

Run: `npm test` → todos passam (17+ anteriores + 7 novos). `npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep -E "lib/esteira|lib/bi|useEsteiraLead"; echo TSC-OK`

```bash
git add src/lib/esteira/queueSummary.ts src/lib/esteira/clicks.ts src/lib/esteira/clicks.test.ts src/lib/bi/clicks.ts src/lib/bi/clicks.test.ts src/lib/bi/reconversao.ts src/hooks/useEsteiraLead.ts
git commit -m "feat(links): agregações puras de cliques (card, timeline, CTR por toque) com testes"
```

---

### Task 10: Hooks — cliques no card, na timeline, por mensagem e realtime

**Files:**
- Modify: `src/hooks/useEsteiraLead.ts`
- Create: `src/hooks/useTrackedLinks.ts`

Depende de: Task 9.

**Interfaces:**
```ts
export function useTrackedLinksByPerson(peopleId?: string | null): UseQueryResult<Map<number, TrackedLinkRow>>  // chave = message_id
export function useTrackedClicksRealtime(): void   // assina INSERT em tracked_link_clicks; invalida ['esteira'], ['tracked-links'], ['bi-reconversao'] (debounce 1,5 s)
```

- [ ] **Step 1: `useEsteiraCardData`** — duas queries em paralelo e merge:

```ts
import { summarizeQueue, emptyQueueSummary, type LeadQueueSummary, type QueueRow } from '@/lib/esteira/queueSummary';
import { clicksToTimeline, summarizeLinkClicks, type TrackedClickRow, type TrackedLinkRow } from '@/lib/esteira/clicks';
…
    queryFn: async (): Promise<Record<string, LeadQueueSummary>> => {
      const [queueRes, linksRes] = await Promise.all([
        db.from('followup_queue')
          .select('lead_id, channel, status, scheduled_for, subject')
          .in('lead_id', leadIds)
          .in('status', ['sent', 'queued', 'delivered', 'read', 'pending', 'processing', 'failed', 'cancelled']),
        db.from('tracked_links')
          .select('id, lead_id, source, label, template_name, channel, clicks, first_clicked_at, last_clicked_at')
          .in('lead_id', leadIds)
          .gt('clicks', 0),
      ]);
      if (queueRes.error) throw queueRes.error;
      if (linksRes.error) throw linksRes.error;
      const out = summarizeQueue((queueRes.data ?? []) as QueueRow[]);
      const clicks = summarizeLinkClicks((linksRes.data ?? []) as TrackedLinkRow[]);
      for (const [leadId, c] of Object.entries(clicks)) (out[leadId] ??= emptyQueueSummary()).clicks = c;
      return out;
    },
```

- [ ] **Step 2: `useLeadEsteira`** — após o bloco dos toques (antes de `if (peopleId) {`), adicione:

```ts
      // ── Cliques em links rastreados do lead (humanos, não duplicados) ─────────
      const [linksRes, clicksRes] = await Promise.all([
        db.from('tracked_links')
          .select('id, lead_id, source, label, template_name, channel, clicks, first_clicked_at, last_clicked_at, message_id')
          .eq('lead_id', leadId)
          .order('created_at', { ascending: false })
          .limit(50),
        db.from('tracked_link_clicks')
          .select('id, tracked_link_id, lead_id, clicked_at, device')
          .eq('lead_id', leadId)
          .eq('is_bot', false)
          .eq('is_duplicate', false)
          .order('clicked_at', { ascending: false })
          .limit(100),
      ]);
      timeline.push(...clicksToTimeline((linksRes.data ?? []) as TrackedLinkRow[], (clicksRes.data ?? []) as TrackedClickRow[]));
```

- [ ] **Step 3: `src/hooks/useTrackedLinks.ts`**

```ts
/**
 * useTrackedLinks — links rastreados por pessoa (indicador "link aberto" na bolha do
 * inbox) e realtime dos cliques (kanban/timeline/inbox/BI atualizam sem F5).
 */
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { TrackedLinkRow } from '@/lib/esteira/clicks';

const db = supabase as unknown as SupabaseClient;

/** Map<messages.id, link> — só links ligados a uma mensagem. Uma query por pessoa. */
export function useTrackedLinksByPerson(peopleId?: string | null) {
  return useQuery({
    queryKey: ['tracked-links', 'person', peopleId],
    enabled: !!peopleId,
    staleTime: 30_000,
    queryFn: async (): Promise<Map<number, TrackedLinkRow>> => {
      const { data, error } = await db
        .from('tracked_links')
        .select('id, lead_id, people_id, source, label, template_name, channel, clicks, first_clicked_at, last_clicked_at, message_id, created_at')
        .eq('people_id', peopleId)
        .not('message_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      const map = new Map<number, TrackedLinkRow>();
      for (const l of (data ?? []) as TrackedLinkRow[]) if (l.message_id != null) map.set(Number(l.message_id), l);
      return map;
    },
  });
}

/** Assina INSERT em tracked_link_clicks (RLS filtra) e invalida as queries que mostram clique. */
export function useTrackedClicksRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel(`tracked-link-clicks-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tracked_link_clicks' }, () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          qc.invalidateQueries({ queryKey: ['esteira'] });
          qc.invalidateQueries({ queryKey: ['tracked-links'] });
          qc.invalidateQueries({ queryKey: ['bi-reconversao'] });
        }, 1500);
      })
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') console.warn('[tracked-link-clicks] realtime', status, err?.message ?? '');
      });
    return () => { if (timer) clearTimeout(timer); supabase.removeChannel(channel); };
  }, [qc]);
}
```

- [ ] **Step 4: Verificar e commitar**

Run: `npm test && npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep -E "useEsteiraLead|useTrackedLinks"; echo TSC-OK`

```bash
git add src/hooks/useEsteiraLead.ts src/hooks/useTrackedLinks.ts
git commit -m "feat(links): hooks — cliques no card e na timeline, links por mensagem, realtime de cliques"
```

---

### Task 11: Kanban — chip "Clicou" · Esteira — entrada de clique na timeline

**Files:**
- Modify: `src/components/negocios/StageColumn.tsx`
- Modify: `src/components/negocios/NegocioEsteira.tsx`
- Modify: `src/components/negocios/KanbanBoard.tsx`

Depende de: Task 10.

- [ ] **Step 1: StageColumn** — imports: `MousePointerClick` de `lucide-react`; `formatDistanceToNowStrict` de `date-fns` e `ptBR` de `date-fns/locale` (se já não importados). No card, onde `cardData[lead.id]` é lido, derive `const clicks = cardData[lead.id]?.clicks;`. Na linha de chips (~linha 288), **logo após** o chip de não lidas, adicione:

```tsx
{clicks && clicks.total > 0 && (
  <Chip tone="info" icon={MousePointerClick}
    title={`Abriu ${clicks.total} ${clicks.total === 1 ? 'vez' : 'vezes'} um link nosso${clicks.lastAt ? ` · último ${formatDistanceToNowStrict(new Date(clicks.lastAt), { locale: ptBR, addSuffix: true })}` : ''}`}>
    Clicou{clicks.lastAt ? ` · ${formatDistanceToNowStrict(new Date(clicks.lastAt), { locale: ptBR, addSuffix: true })}` : ''}
  </Chip>
)}
```
Regra de 4 chips: quando o chip "Clicou" aparece, **não** renderize o chip `+{tags.length - 1}` (mantenha a 1ª tag com `title` listando as demais). No `aria-label` do card, acrescente `, clicou no link` quando `clicks.total > 0`.

- [ ] **Step 2: KanbanBoard** — importe `useTrackedClicksRealtime` de `@/hooks/useTrackedLinks` e chame `useTrackedClicksRealtime();` no topo do componente `KanbanBoard` (junto dos outros hooks).

- [ ] **Step 3: NegocioEsteira** — em `entryVisual` (linha ~43) adicione antes do `if (e.kind === 'toque')`: `if (e.kind === 'clique') return { icon: MousePointerClick, cls: 'text-sky-500' };` (importe `MousePointerClick`). Na renderização do título (~linha 202), entradas `kind === 'clique'` usam `e.title` como está. Chame `useTrackedClicksRealtime();` no componente (importar do hook).

- [ ] **Step 4: Verificar e commitar**

Run: `npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep -E "StageColumn|NegocioEsteira|KanbanBoard"; echo TSC-OK; npx eslint src/components/negocios/StageColumn.tsx src/components/negocios/NegocioEsteira.tsx src/components/negocios/KanbanBoard.tsx`
Visual: kanban com lead que clicou → chip azul "Clicou · há 2 h"; aba Esteira → "Abriu o link · WhatsApp · …" com ícone de cursor.

```bash
git add src/components/negocios/StageColumn.tsx src/components/negocios/NegocioEsteira.tsx src/components/negocios/KanbanBoard.tsx
git commit -m "feat(kanban/esteira): chip Clicou no card e clique na timeline do lead, com realtime"
```

---

### Task 12: Inbox — "Link aberto HH:mm" na bolha

**Files:**
- Modify: `src/components/conversas/ConversaDetalhes.tsx`
- Modify: `src/components/negocios/conversa/MessageList.tsx`

Depende de: Task 10.

- [ ] **Step 1: ConversaDetalhes** — importe `useTrackedLinksByPerson, useTrackedClicksRealtime` de `@/hooks/useTrackedLinks`, `MousePointerClick` de `lucide-react`. No componente: `const { data: linksByMessage } = useTrackedLinksByPerson(pessoaId); useTrackedClicksRealtime();`. No rodapé da bolha (~linha 247, dentro de `<div className="flex items-center gap-2 mt-2 text-xs opacity-75">`), após o bloco `{!isFromClient && (<> … <MessageStatusTicks … /> </>)}`, adicione:

```tsx
{!isFromClient && (() => {
  const link = linksByMessage?.get(Number(message.id));
  if (!link || link.clicks <= 0 || !link.first_clicked_at) return null;
  return (
    <>
      <span>•</span>
      <span className="inline-flex items-center gap-1" title={`Abriu o link ${link.clicks}x · último ${format(new Date(link.last_clicked_at ?? link.first_clicked_at), 'dd/MM HH:mm')}`}>
        <MousePointerClick className="h-3 w-3" aria-hidden />
        Link aberto {format(new Date(link.first_clicked_at), 'HH:mm')}{link.clicks > 1 ? ` (${link.clicks}x)` : ''}
      </span>
    </>
  );
})()}
```

- [ ] **Step 2: MessageList (conversa do lead no kanban)** — mesmo padrão: `const { data: linksByMessage } = useTrackedLinksByPerson(pessoaAtual?.id ?? null); useTrackedClicksRealtime();`. No "Footer: time + status" (~linha 338), após `<MessageStatusTicks status={conversa.status} />`, adicione o mesmo trecho usando `conversa.id` e `isOutgoing`. Estilo do rodapé já existente (`text-[10px]`/`text-muted-foreground`).

- [ ] **Step 3: Verificar e commitar**

Run: `npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep -E "ConversaDetalhes|MessageList"; echo TSC-OK; npx eslint src/components/conversas/ConversaDetalhes.tsx src/components/negocios/conversa/MessageList.tsx`
Visual: mensagem de template/botão do agente cujo link foi clicado mostra "Link aberto 22:31".

```bash
git add src/components/conversas/ConversaDetalhes.tsx src/components/negocios/conversa/MessageList.tsx
git commit -m "feat(inbox): indicador 'Link aberto HH:mm' nas mensagens com link rastreado"
```

---

### Task 13: BI — taxa de clique por toque e qual link converteu

**Files:**
- Modify: `src/hooks/useReconversaoBI.ts`
- Create: `src/components/dashboard/reconversao/ClickRateCard.tsx`
- Modify: `src/components/dashboard/BIProReconversaoTab.tsx`
- Modify: `src/components/dashboard/reconversao/ReconversionsTable.tsx`

Depende de: Task 9 (e Task 0 aplicada em produção para as colunas `attributed_*`; até lá vêm `undefined` e a UI cai no texto antigo).

- [ ] **Step 1: Hook** — em `useReconversaoBI.ts`:
  - `ReconversionRow`: adicione `attributed_link_source?: string | null; attributed_template_name?: string | null;`.
  - No `Promise.all` (~linha 128) acrescente uma 4ª query — links **criados** no período (base do CTR):
```ts
        db.from('tracked_links')
          .select('source, label, template_name, channel, clicks')
          .gte('created_at', from)
          .lte('created_at', to)
          .limit(10000),
```
  - Desestruture como `linksRes`, `if (linksRes.error) throw linksRes.error;` e passe `links: (linksRes.data ?? []) as never` para `aggregateReconversao({ …, links })`. Mantenha a query de `clicks` existente (funil "clicaram").

- [ ] **Step 2: `ClickRateCard.tsx`**

```tsx
import { Chip } from '@/components/ui/chip';
import type { Agregado } from '@/lib/bi/reconversao';

const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);

export default function ClickRateCard({ linhas, geral }: { linhas: Agregado['cliquesPorToque']; geral: Agregado['ctrGeral'] }) {
  const top = linhas.slice(0, 6);
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-baseline justify-between">
        <p className="text-[13px] font-medium text-foreground">Taxa de clique por toque</p>
        <span className="text-[11px] text-muted-foreground tabular-nums">{geral.clicados} de {geral.enviados} links abertos · {pct(geral.ctr)}</span>
      </div>
      {top.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">Nenhum link enviado no período.</p>
      ) : (
        <ul className="space-y-2">
          {top.map((r) => (
            <li key={r.key} className="space-y-1">
              <div className="flex items-center justify-between text-[12px]">
                <span className="truncate text-foreground">{r.label}</span>
                <span className="tabular-nums text-muted-foreground">{r.clicados}/{r.enviados} · <span className="font-semibold text-foreground">{pct(r.ctr)}</span></span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden" aria-hidden>
                <div className="h-full rounded-full bg-sky-500" style={{ width: `${Math.round((r.ctr ?? 0) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-muted-foreground">Só cliques humanos contam — visitas de robôs de preview (WhatsApp, e-mail) ficam de fora.</p>
      {linhas.length > top.length && <Chip>+{linhas.length - top.length} toques</Chip>}
    </div>
  );
}
```

- [ ] **Step 3: BI tab** — importe `ClickRateCard` e, no grid que contém `<FunnelCard …/>` e `<AttributionCard …/>` (~linhas 68–70), adicione `<ClickRateCard linhas={data.agregado.cliquesPorToque} geral={data.agregado.ctrGeral} />` como 3º item; troque as classes do grid para `grid gap-4 md:grid-cols-2 xl:grid-cols-3`. Chame `useTrackedClicksRealtime()` no componente (importar de `@/hooks/useTrackedLinks`).

- [ ] **Step 4: Tabela** — em `ReconversionsTable.tsx` (~linha 126), troque o texto do chip do nível `clique` de `'Clique rastreado'` para `` `Clique · ${r.attributed_template_name ?? r.attributed_link_source ?? 'link'}` `` e o `title` para `` `Clicou em link nosso (${r.attributed_template_name ?? 'toque não identificado'}) antes de pagar` ``. No CSV (~linha 23) acrescente a coluna `r.attributed_template_name ?? ''` (e o cabeçalho correspondente "toque_do_clique").

- [ ] **Step 5: Verificar e commitar**

Run: `npm test && npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep -E "useReconversaoBI|ClickRateCard|BIProReconversaoTab|ReconversionsTable"; echo TSC-OK; npm run build 2>&1 | tail -1`

```bash
git add src/hooks/useReconversaoBI.ts src/components/dashboard/reconversao/ClickRateCard.tsx src/components/dashboard/BIProReconversaoTab.tsx src/components/dashboard/reconversao/ReconversionsTable.tsx
git commit -m "feat(bi): taxa de clique por toque e qual toque gerou a atribuição por clique"
```

---

### Task 14: Migration, deploy, QA manual e push

**Files:** nenhum novo (só verificação). Um executor, por último.

- [ ] **Step 1: Baseline de tipos e testes**

```bash
cd /Volumes/nvme/minimal/Minimal-Cases-RevOS
npm test
deno test --allow-env --allow-net supabase/functions/_shared/click-classifier.test.ts supabase/functions/_shared/tracked-links-url.test.ts supabase/functions/_shared/click-context.test.ts supabase/functions/_shared/click-nudge.test.ts supabase/functions/ai-callback-worker/logic.test.ts
git stash; npx tsc -p tsconfig.app.json --noEmit 2>&1 | wc -l; git stash pop; npx tsc -p tsconfig.app.json --noEmit 2>&1 | wc -l   # depois ≤ antes
npm run build
```

- [ ] **Step 2: Migration** — `supabase migration list` (confirmar que `20260904100000` e `20260904110000` estão pendentes e nada mais), depois `supabase db push`. Verificar no SQL editor: `select column_name from information_schema.columns where table_name='tracked_links' and column_name in ('source','message_id','followup_queue_id');` → 3 linhas; `select proname from pg_proc where proname='record_tracked_click';` → 1; `select tablename from pg_publication_tables where pubname='supabase_realtime' and tablename='tracked_link_clicks';` → 1.

- [ ] **Step 3: Secrets (opcional, recomendado)** — `supabase secrets set TRACKED_LINKS_SALT=$(openssl rand -hex 32)`. **Não** setar `TRACKED_LINK_BASE_URL` até a cliente decidir o domínio (Spec §8.1).

- [ ] **Step 4: Deploy só das funções tocadas**

```bash
supabase functions deploy r followup-trigger-worker ai-agent-execute yampi-process-event ai-callback-worker
```
(`r` mantém `verify_jwt=false` via `config.toml`; as demais seguem o padrão delas.)

- [ ] **Step 5: QA — antibot e latência (sem mexer em trava nenhuma)**

Pegue um token existente: `select token from tracked_links order by created_at desc limit 1;` → `TOKEN`. Base: `https://maigkwlgzinykfvemexf.supabase.co/functions/v1/r?t=`.

```bash
B="https://maigkwlgzinykfvemexf.supabase.co/functions/v1/r?t=TOKEN"
curl -sI -A "WhatsApp/2.23.20.0 A" "$B" | head -1                     # 302 — crawler
curl -sI -A "facebookexternalhit/1.1" "$B" | head -1                   # 302
curl -sI -X HEAD -A "Mozilla/5.0 (Macintosh) Chrome/124 Safari/537.36" "$B" | head -1   # 302 — method
for i in 1 2 3 4 5; do curl -s -o /dev/null -w '%{time_total}\n' -A "WhatsApp/2.23.20.0 A" "$B"; done   # cada < 0.30s
curl -sI -A "Mozilla/5.0 (Macintosh) Chrome/124 Safari/537.36" -H "Accept: text/html,*/*;q=0.8" "$B" | head -1   # 302 — humano (conta 1)
curl -sI -A "Mozilla/5.0 (Macintosh) Chrome/124 Safari/537.36" -H "Accept: text/html,*/*;q=0.8" "$B" | head -1   # 302 — duplicata (<10s, mesmo IP)
```
SQL: `select is_bot, bot_reason, is_duplicate, device, length(ip_hash) from tracked_link_clicks where tracked_link_id=(select id from tracked_links where token='TOKEN') order by id;` → 3 linhas bot (`ua`,`ua`,`method`), 1 humana, 1 humana `is_duplicate=true`; `ip_hash` com 32 chars; `select clicks, bot_hits from tracked_links where token='TOKEN'` → clicks aumentou **1**, bot_hits **3**. Lead do link não mudou de stage por causa dos robôs (só pelo clique humano). `curl -sI "…/r?t=NAOEXISTE"` → 302 para a loja.

- [ ] **Step 6: QA — fluxo real pelo número da allowlist (5538991971527)**

Pré-condição (já configurada pela operação; **não** alterar aqui): `omni_channel_configs.settings` do WhatsApp com `sends_locked=false` e `test_allowlist=['5538991971527']`. Se estiver travado, pare e peça a quem opera para liberar — este plano não mexe em trava.
  1. Disparar um toque WA da esteira para o lead de teste desse número (ou pedir ao agente, no WhatsApp, "me manda o link do carrinho" → tool `yampi_enviar_link_carrinho`).
  2. Verificar em `tracked_links` a linha nova: `source` (`esteira_whatsapp`/`agente`), `template_name`/`label`, `followup_queue_id` ou `execution_id`, e `message_id` **preenchido**.
  3. Tocar no botão no celular. Sem F5: card do kanban mostra "Clicou · há menos de 1 min"; aba Esteira mostra "Abriu o link · WhatsApp · …· celular"; inbox mostra "Link aberto HH:mm" na bolha certa; lead vai para "Engajou" (se estava antes).
  4. Repetir o toque no botão: `clicks=2`, chip "(2x)" no inbox, "2º clique" na timeline.
  5. BI Reconversão (30d): card "Taxa de clique por toque" lista o template com 1/1 · 100%.
  6. `select * from ai_scheduled_callbacks where reason='clique_sem_compra';` → **vazio** (nudge desligado por padrão).

- [ ] **Step 7: QA — nudge (opcional, só com a allowlist ativa)**
  1. `update omni_channel_configs set settings = settings || '{"click_nudge_enabled": true, "click_nudge_delay_minutes": 5}' where channel='whatsapp';`
  2. Novo link + clique pelo celular → 1 linha `pending` em `ai_scheduled_callbacks` (`mode=agent`, `reason=clique_sem_compra`); `tracked_links.nudge_scheduled_at` preenchido; 2º clique **não** cria outra.
  3. Caso A (cliente respondeu nas últimas 24h): após 5 min o agente manda 1 frase perguntando o que travou, sem link. Caso B (sem inbound em 24h): a linha vira `failed` com "fora da janela de 24h… nenhum template aprovado" — comportamento esperado até a cliente aprovar um template.
  4. Mandar um `pix_gerado`/`pedido_pago` de teste (ou mover o lead para "Pagamento pendente" e aguardar) → callback `cancelled`/`skipped`.
  5. **Desligar:** `update omni_channel_configs set settings = settings - 'click_nudge_enabled' - 'click_nudge_delay_minutes' where channel='whatsapp';`

- [ ] **Step 8: Checklist visual** (claro/escuro, 1280 px): chip "Clicou" `tone="info"` sem quebrar a linha; timeline com ícone de cursor; indicador no inbox em `text-xs`; card do BI com barras `bg-sky-500`; nenhum canto reto novo; nenhum emoji em rótulo.

- [ ] **Step 9: Push**

```bash
git pull -q --rebase origin main && npm test && npm run build && git push origin main
```

---

## Self-review (feito pelo autor do plano)

- **Cobertura da spec:** O1 origem (Tasks 0, 2, 5, 6) · O2 eventos (0, 4) · O3 antibot (1, 4) · O4 redirect rápido (0, 4) · O5 UI + realtime (9–13) · O6 agente + nudge (2, 3, 6, 7, 8) · O7 base configurável (2) · atribuição "qual link" (7, 13) · LGPD (0, 4) · QA real com allowlist e crawler (14).
- **Travas:** nenhuma tarefa lê ou escreve `sends_locked`, `test_allowlist`, `agent_requires_outreach`, nem toca `whatsapp-send-lock.ts` ou o bloco de trava do `whatsapp-outbound`. O nudge só insere em `ai_scheduled_callbacks`; o caminho de envio é o existente.
- **Consistência de nomes:** `createTrackedLinkDetailed`/`attachTrackedLinkMessage`/`buildTrackedUrl`/`trackedLinkBaseUrl`/`findTrackedClickBefore` (Task 2 → 5, 6, 7); `classifyClick`/`clickInfoFromRequest`/`extractClientIp`/`hashIp` (1 → 4); `scheduleClickNudge`/`parseClickNudgeSettings`/`decideNudge` (3 → 4); `record_tracked_click` (0 → 4); `describeClicksForAgent` (2 → 6); `summarizeLinkClicks`/`clicksToTimeline`/`describeLinkOrigin`/`emptyQueueSummary`/`LeadClickSummary` (9 → 10, 11); `aggregateClickRates`/`overallClickRate`/`cliquesPorToque`/`ctrGeral` (9 → 13); `useTrackedLinksByPerson`/`useTrackedClicksRealtime` (10 → 11, 12, 13); `kind: 'clique'` (9 → 10, 11).
- **Sem placeholders:** DDL, RPC, classificador, `r`, hooks e componentes trazem o código; passos de integração apontam arquivo, âncora (linha aproximada + trecho) e o que trocar.
- **Ordem/paralelismo:** declarados no Mapa de arquivos; a Task 14 é a única que aplica migration e faz deploy.
