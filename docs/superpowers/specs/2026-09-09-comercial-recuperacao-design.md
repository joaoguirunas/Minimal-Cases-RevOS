# Spec — Perfil Comercial: recuperação manual de carrinhos com 15d+, cupom até 20% e comissão

**Data:** 09/09/2026 · **Autor:** arquitetura (Growth Sales) · **Executores:** agentes em paralelo (mesmo modelo das rodadas 2 e 3)
**Repo:** `Minimal-Cases-RevOS` (Vite + React 18 + TS + shadcn/Tailwind + TanStack Query v5 · Supabase Postgres + Edge Functions Deno)
**Pedido da cliente (verbatim):**

> precisamos preparar esse acesso para os usuários do comercial dele, quando um usuário for do tipo comercial, no BI só deve mostrar o recuperado por ELE, no Kanban deve ter uma única esteira (pipeline) que mostra apenas carrinhos abandonados (nunca pagos, recuperados, etc a não ser que sejam recuperados por ele) e apenas de 15d atrás, nunca deve mostrar mais recentes, o trabalho dele é recuperar carrinhos. ou seja, ele deve conseguir gerar o cupom de até 20%, e temos que trackear as compras com esse cupom para o comercial receber comissões depois. e adapta a visão quando clica, pra mostrar as fotos do produto também a prévia (isso tanto para admin quanto comercial, fica melhor a visualização)

**Decisões tomadas com a cliente no brainstorming (09/09):**

| Pergunta | Decisão |
|---|---|
| Como um carrinho vira "do comercial"? | **Piscina compartilhada.** Todo comercial vê todos os carrinhos com 15d+ sem dono; vira dele na primeira ação (assumir ou gerar cupom). Depois os outros não veem. |
| O que conta como recuperado por ele? | **Cupom dele, OU carrinho dele pago em até 7 dias depois de assumir.** Cupom vence a janela quando são comerciais diferentes. |
| Por onde ele fala com o cliente? | **WhatsApp oficial do CRM** (tela Conversas), o mesmo número da Zoppy e do agente. |
| Comissão | **% por comercial** (cadastro do usuário) **+ relatório mensal no BI** do admin. |
| Assumir cancela a esteira automática? | **Não.** Só o primeiro WhatsApp humano cancela os toques de WhatsApp pendentes daquele lead (e-mail e SMS seguem) e desliga o agente pra essa pessoa. |
| Galeria de fotos do produto | **Não.** Só a capa (foto do SKU já em cache) em tamanho de prévia, no detalhe e no card. |
| Abordagem | **A — regra no banco (RLS), UI se adapta.** Descartadas: filtro só no frontend (inseguro) e área `/comercial` separada (duplica tudo). |

**Antecessores:** `2026-09-05-esteira-rodada-3.md` · `2026-09-04-links-rastreados.md` · migration `20260908170000_security_rls_hardening.sql` (RLS em todas as tabelas; políticas `TO authenticated USING ((select public.is_app_user()))`; escrita de credenciais e `settings_users` só `is_admin_or_manager()`).

---

## 1. Estado verificado em 09/09

- **Papéis:** `settings_users.user_type ∈ {admin, manager, user, comercial}` (check constraint). `useUserPermissions` já expõe `isComercial`. Hoje os 5 usuários são admin/super_admin. Nenhum comercial existe.
- **Pipeline de produção** "Esteira Minimal — Loja" (`99269957-2359-4961-82e0-4099c3b033b7`), stages por `order_index`: 0 Carrinho abandonado · 1 Em recuperação · 2 Engajou · 3 Pagamento pendente · 4 Pagamento recusado · 5 Recuperado · 6 Perdido. Recebe eventos reais desde 03/09 → **hoje nenhum lead tem 15d+**; o pool começa a encher ~18/09. "Esteira Validação" (`3fffabd5-…`) guarda os 297 do backfill e **fica fora** do escopo do comercial.
- **Data do carrinho:** `leads.created_at` é a data real do carrinho (o `yampi-process-event` grava o `created_at` do recurso Yampi, não o do processamento).
- **Dono do lead:** `leads.user_id` (uuid → `settings_users.id`) existe e é `NULL` em todos os leads da esteira. `leads.teams_id` idem.
- **Cupom hoje:** só o agente cria, via tool `yampi_criar_cupom` em `ai-agent-execute/index.ts` (~l.2668–2730): `POST /pricing/promocodes` (`discount_type:'p'`, `quantity:1`, `once_per_customer`, `min_value:0` obrigatório, `start_at/end_at`), código `NOME{pct}` com colisão `NOME{pct}X2..9`, máx. 15%, e `upsert crm_coupons {code, source:'agente', people_id}`. Cliente Yampi: `findPromocode`, `createPromocode` em `_shared/yampi-client.ts` (~l.335–370).
- **Atribuição hoje** (`yampi-process-event`, `pedido_pago`, ~l.380–435): cupom ∈ `crm_coupons` → `attribution_level='cupom'`; senão clique rastreado ≤7d → `'clique'`; senão toque ≤7d → `'janela'`. Grava em `esteira_reconversions` (`coupon_code`, `attribution_level`, `attributed_link_*`). **Não sabe quem é humano.**
- **Stage por nome:** `_shared/esteira-progress.ts` → `progressEsteiraStage(leadId, nome)` só avança (`order_index` maior). `_shared/click-nudge.ts` → `NUDGE_BLOCKED_STAGES = ['Pagamento pendente','Recuperado','Perdido']`. `r/index.ts` move pra "Engajou" no clique humano.
- **Agente:** `ai-agent-execute` respeita `clients_people.ai_enabled=false` (gate G1, `ai_skipped_human_takeover`, ~l.3472) e o gate `agent_requires_outreach` (só responde quem nós abordamos em 24h). Handoff humano já é `UPDATE clients_people SET ai_enabled=false`.
- **Envio humano de WhatsApp:** `useConversas.ts` (~l.350–372) insere em `messages` (`from_contact`, `user_id = settings_users.id do autor`, `content`) e invoca `whatsapp-outbound` com `message_ids`. A function aplica trava global + allowlist (`_shared/whatsapp-send-lock.ts`) e atualiza `messages.wa_message_id/status` (~l.1340–1365).
- **Templates Meta da esteira:** criados pela ação `bootstrap_wa_templates` de `yampi-connect/index.ts` (~l.472, definições ~l.537–563, prefixo `minimal_esteira_`), botão "Criar templates na Meta" em `YampiIntegrationConfig.tsx` l.492. `whatsapp-templates-sync` sincroniza status e ativa regras.
- **Kanban:** `pages/Negocios.tsx` (pipeline ativo `pipelineFilter`, `NovoNegocioModal`, mover em massa) → `KanbanBoard.tsx` (drag via `destination.droppableId`) → `StageColumn.tsx` (card: chips de toques/cliques/não-lidas, tags; **sem foto**). `usePipelinesReal.ts` (`usePipelines`, `useStages`) lista tudo que a RLS devolve.
- **Detalhe do lead:** `NegocioSingle.tsx` abre na aba Esteira → `NegocioEsteira.tsx`; bloco "Carrinho" (~l.110–135) mostra `cart.image` em 56×56 px + chips de variação. `useEsteiraLead.ts` resolve `image` do payload Yampi; a foto real do SKU vem de `yampi_sku_images` (cache, Shopify CDN 500×500).
- **BI:** `pages/Dashboard.tsx` — abas `reconversao | revops | comercial | marketing | insights`, as antigas comentadas; `BIProReconversaoTab.tsx` usa `useReconversaoBI(dateFrom,dateTo)` (lê `esteira_reconversions`, `followup_queue`, `tracked_links`, `clients_people` direto) e compõe `KpiHero`, `FunnelCard`, `AttributionCard`, `ClickRateCard`, `DailyChart`, `ReconversionsTable`, `InsightsStrip` (`components/dashboard/reconversao/`). Sidebar (`DashLayout.tsx` l.224, 280–312): BI PRO™ tem `requireGestor` → **comercial hoje não vê BI**. Rota `/bipro` é só `ModuleProtectedRoute moduleKey="dashboard"`.
- **Usuários:** `EditarUsuarioModal.tsx` já tem radio "Comercial" (l.293); sem campo de comissão. `settings_users` não tem coluna de comissão.
- **RLS atual nas tabelas tocadas** (pós-hardening): `leads`/`clients_people` SELECT+UPDATE `is_app_user()`, INSERT `is_app_user()`, DELETE `is_admin_or_manager()`; `messages` SELECT com escopo (admin/gestor OU dono OU time OU pipeline acessível), INSERT/UPDATE/DELETE `is_app_user()`; `crm_coupons`, `tracked_links`, `esteira_reconversions` SELECT `active users` + ALL `service_role`; `followup_queue` SELECT+ALL `is_app_user()`.

---

## 2. Modelo de dados

### 2.1 Migration `20260909100000_comercial_recuperacao.sql`

```sql
-- dono, janela e SKU do carrinho (pra foto da capa sem ler o payload)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS sku_id integer;   -- preenchido pelo yampi-process-event; backfill one-shot no Loja
CREATE INDEX IF NOT EXISTS idx_leads_comercial_pool
  ON public.leads (leads_pipelines_id, leads_stages_id, created_at) WHERE user_id IS NULL;

-- comissão
ALTER TABLE public.settings_users ADD COLUMN IF NOT EXISTS commission_pct numeric(5,2)
  CHECK (commission_pct IS NULL OR (commission_pct >= 0 AND commission_pct <= 100));

-- cupom com autor
ALTER TABLE public.crm_coupons
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.settings_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lead_id    uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS percent    integer CHECK (percent IS NULL OR percent BETWEEN 1 AND 100),
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_crm_coupons_created_by ON public.crm_coupons (created_by) WHERE created_by IS NOT NULL;

-- link rastreado gerado por humano (clique aparece como "Comercial · cupom" no BI)
ALTER TABLE public.tracked_links ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.settings_users(id) ON DELETE SET NULL;

-- atribuição humana (imutável depois de gravada)
ALTER TABLE public.esteira_reconversions
  ADD COLUMN IF NOT EXISTS recovered_by     uuid REFERENCES public.settings_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recovery_basis   text CHECK (recovery_basis IN ('cupom','janela')),
  ADD COLUMN IF NOT EXISTS commission_pct   numeric(5,2),
  ADD COLUMN IF NOT EXISTS commission_value numeric(12,2);
CREATE INDEX IF NOT EXISTS idx_esteira_rec_recovered_by ON public.esteira_reconversions (recovered_by, paid_at) WHERE recovered_by IS NOT NULL;

-- stage "Em negociação" no pipeline Loja (e só nele), entre Engajou (2) e Pagamento pendente (3)
-- → reindexa 3..6 para 4..7 e insere order_index 3. Idempotente (não cria se já existir).
```

Cupons antigos do agente ficam com `created_by NULL` → nunca geram comissão. `source` passa a aceitar `'comercial'`.

### 2.2 Stage "Em negociação"

Criado **apenas** no pipeline Loja. Sem regra em `leads_stages_followups` (nenhum toque automático nasce dele). Entra em `NUDGE_BLOCKED_STAGES` (click-nudge não dispara) e o `r/index.ts` **não move** lead que esteja em "Em negociação" para "Engajou" (regressão de posse): `progressEsteiraStage` já é forward-only, e como Em negociação (3) > Engajou (2), o clique é no-op — nada a mudar ali, só o teste que prova isso. `pedido_pago` continua movendo pra "Recuperado" como hoje (forward). `pedido_cancelado` → "Perdido" como hoje.

### 2.3 Funções SQL (todas `SECURITY DEFINER STABLE SET search_path = public, pg_temp`, EXECUTE revogado de PUBLIC/anon, concedido a `authenticated, service_role`)

```sql
public.current_user_type() RETURNS text
  -- settings_users.user_type do auth.uid(), NULL se não houver perfil ativo

public.is_commercial() RETURNS boolean
  -- current_user_type() = 'comercial'

public.commercial_pool_lead(p_lead public.leads) RETURNS boolean
  -- pipeline = Loja (por NOME 'Esteira Minimal — Loja', como o resto do sistema resolve pipelines)
  -- AND stage.name IN ('Carrinho abandonado','Em recuperação','Engajou')
  -- AND p_lead.created_at <= now() - interval '15 days'
  -- AND p_lead.user_id IS NULL
  -- AND p_lead.status NOT IN ('lost','archived','won')

public.lead_visible_to_commercial(p_lead public.leads) RETURNS boolean
  -- p_lead.user_id = get_current_settings_user_id() OR commercial_pool_lead(p_lead)
```

Resolver pipeline por nome segue a convenção do repo ("resolve pipeline POR NOME — não renomear os pipelines", memória ZPY-3). A função lê o id uma vez por query (InitPlan) — custo desprezível.

### 2.4 RPC `public.claim_lead(p_lead_id uuid) RETURNS jsonb` (SECURITY DEFINER, EXECUTE só `authenticated`)

```
exige is_commercial() (admin/gestor usam o kanban normal; se precisarem atribuir, é UPDATE direto)
UPDATE leads
   SET user_id = me, claimed_at = now(), leads_stages_id = <id de 'Em negociação' do pipeline do lead>
 WHERE id = p_lead_id AND user_id IS NULL AND commercial_pool_lead(leads)
RETURNING id
→ 1 linha: {ok:true}
→ 0 linhas: {ok:false, reason:'ja_assumido' | 'fora_do_pool'}  (distingue lendo o lead depois)
```

Atômico: dois comerciais no mesmo lead → um ganha, o outro recebe `ja_assumido`. **Não** mexe em `followup_queue` nem em `ai_enabled` (decisão da cliente).

### 2.5 Políticas de RLS (substituem/estendem as atuais; admin/gestor/user continuam como hoje)

Princípio: para `is_commercial()`, a condição é **restritiva adicional** via política separada, nunca afrouxa o que existe. Postgres combina políticas permissivas com OR — por isso as políticas atuais `authenticated_read USING (is_app_user())` passam a ter `AND NOT is_commercial()`, e entram políticas `comercial_*` com a condição estreita. Um comercial cai **só** nas `comercial_*`.

| Tabela | Comercial pode |
|---|---|
| `leads` | SELECT `lead_visible_to_commercial(leads)` · UPDATE `user_id = me` (editar só os dele; assumir é pela RPC) · INSERT/DELETE não |
| `clients_people` | SELECT se existe lead visível com `people_id = id` · UPDATE idem (edita contato dos dele/pool) · INSERT/DELETE não |
| `messages` | SELECT se `people_id` ∈ pessoas de leads visíveis · INSERT com `user_id = me` e mesma condição · UPDATE só as próprias (`user_id = me`) · DELETE não |
| `followup_queue` | SELECT de leads visíveis (timeline do lead) · sem escrita |
| `tracked_links`, `tracked_link_clicks` | SELECT de leads visíveis (chip "Clicou") · sem escrita |
| `esteira_reconversions` | SELECT `recovered_by = me` · sem escrita |
| `crm_coupons` | SELECT `created_by = me` · INSERT `created_by = me` (a function usa service_role, mas a política existe por defesa) · sem UPDATE/DELETE |
| `leads_pipelines`, `leads_stages` | SELECT só do pipeline Loja (`name = 'Esteira Minimal — Loja'`) — esconde "Validação", RFM e Kiwify do seletor |
| `settings_users` | SELECT só a própria linha. (O chip "Comercial: Fulano" é do kanban do admin, que já lê todos.) |
| `email_templates`, `whatsapp_templates`, `settings_system_modules`, `notifications` (as dele), `canned_responses` | SELECT como qualquer `is_app_user()` (inofensivas, necessárias pra UI carregar) |
| Tudo o mais (`omni_channel_configs`, `settings*`, `yampi_*`, `zoppy_*`, BI ads, etc.) | **nada** |

`yampi_sku_images` (foto da capa): SELECT liberado a `is_app_user()` (é cache de URL pública do Shopify; hoje é `service_role` only — o front nunca leu direto; aqui passa a ler).

---

## 3. Cupom do comercial

### 3.1 `_shared/yampi-coupon.ts` (extraído de `ai-agent-execute`)

```ts
export const COUPON_PERCENTS_AGENT = [5, 10, 15] as const;
export const COUPON_PERCENTS_COMMERCIAL = [5, 10, 15, 20] as const;
export async function createPersonalCoupon(supabase, opts: {
  firstName: string; percent: number; validityDays: number; freeShipping?: boolean;
  peopleId: string | null; leadId: string | null;
  source: 'agente' | 'comercial'; createdBy: string | null;   // settings_users.id
}): Promise<{ code: string; percent: number; expiresAt: string; reused: boolean }>
```

Mesma lógica de hoje (código `NOME{pct}`, colisão `X2..9`, `once_per_customer`, `quantity:1`, `min_value:0`, `start_at/end_at`), mais o `upsert crm_coupons` com `source, created_by, lead_id, percent, expires_at`. O case `yampi_criar_cupom` do agente passa a chamar esta função com `source:'agente', createdBy:null` — **comportamento idêntico ao atual**, coberto por teste de regressão.

### 3.2 Edge function `commercial-coupon-create`

`POST { lead_id, percent ∈ {5,10,15,20}, validity_days 1..7 (default 3) }` · JWT do usuário.

1. Valida JWT → `settings_users` ativo; exige `user_type = 'comercial'` **ou** `is_admin_or_manager()`.
2. Carrega o lead com o client **do usuário** (anon key + JWT) — se a RLS não devolver, 404 "lead não visível".
3. Se `lead.user_id IS NULL` → chama `claim_lead` (mesmo client). Se `ja_assumido` → 409.
4. Se `lead.user_id ≠ me` e não é admin → 403.
5. `createPersonalCoupon(service_role, …, source:'comercial', createdBy: me)`.
6. Devolve `{ code, percent, expires_at, price, price_with_coupon, cart_url, message_preview }` — `message_preview` é o texto do template (§5.1) já preenchido, pra UI copiar/enviar.

Rate limit: 1 cupom ativo por lead (se já existe `crm_coupons` não expirado do mesmo `lead_id`, devolve o existente com `reused:true`; não cria outro). Erros da Yampi (422 etc.) → 502 com a mensagem.

### 3.3 Atribuição em `yampi-process-event` (`pedido_pago`)

Logo depois de `isOurCoupon` (l.~404) e antes do `upsert`:

```
recoveredBy = null; basis = null
if (couponCode) {
  cc = select id, created_by from crm_coupons where code = couponCode
  if (cc?.created_by) { recoveredBy = cc.created_by; basis = 'cupom' }
}
if (!recoveredBy && lead?.user_id && lead?.claimed_at
    && paidAt <= claimed_at + 7d) { recoveredBy = lead.user_id; basis = 'janela' }
if (recoveredBy) {
  pct = select commission_pct from settings_users where id = recoveredBy  (null → 0)
  commissionValue = round(parsed.total * pct / 100, 2)
}
upsert(...existing, recovered_by, recovery_basis, commission_pct: pct, commission_value)
```

`attribution_level` continua como hoje (é a prova da esteira); `recovery_basis` é a prova **humana**. Um pedido pode ter `attribution_level='cupom'` e `recovered_by` preenchido — é o caso normal do comercial. Snapshot de `commission_pct` no pedido: mudar o % do comercial depois **não** reescreve histórico.

---

## 4. UI

### 4.1 Permissões no front

`useUserPermissions` já tem `isComercial`. Novo hook `useCommercialScope()` devolve `{ isComercial, poolStageNames, lojaPipelineId }` (lojaPipelineId vem do `usePipelines` — só virá o Loja pela RLS).

### 4.2 Kanban (`pages/Negocios.tsx`, `KanbanBoard.tsx`, `StageColumn.tsx`)

Quando `isComercial`:
- Seletor de pipeline escondido (só há um). Botões "Novo negócio", "Mover em massa", filtros de dono/time e popover de mais filtros escondidos. Busca por nome/telefone fica.
- **Três colunas virtuais** em vez das stages reais: `Carrinhos disponíveis` (leads cujo stage ∈ pool names — já filtrados pela RLS a 15d+/sem dono), `Em negociação` (stage real), `Recuperado` (stage real). Implementação: `KanbanBoard` recebe `columns: Array<{ id, title, stageIds: string[] }>`; hoje 1 coluna = 1 stage, vira N stages por coluna (mudança pequena, `StageColumn` agrupa por `stageIds.includes(lead.leads_stages_id)`).
- `DragDropContext` desativado (`isDragDisabled`). Card da coluna "Disponíveis" ganha botão **Assumir** → `rpc('claim_lead')` → toast; `ja_assumido` → "Outro comercial pegou este carrinho" e o card some (invalidate).
- Card: miniatura 40×40 da capa (`useSkuImages`, §4.4), nome, `produto · modelo`, valor, chip de idade `há 19 dias` (de `created_at`). Nos dele: chip de cupom (`NOME20 · até 12/09`) e "último contato há 2h" (de `messages` do autor).

Quando **não** é comercial: kanban igual a hoje + stage "Em negociação" aparece como coluna normal; card com dono mostra chip `Comercial: Fulano` (`leads.user_id` → nome via `useUsersNew`, que admin já carrega).

### 4.3 Detalhe do lead — `NegocioEsteira.tsx`

- Bloco "Carrinho": a `<img>` de 56 px vira **prévia da capa**: 200×200 no desktop (`w-[200px] h-[200px] rounded-xl object-cover`), 120 px no mobile, com nome do produto, modelo e valor ao lado; chips de variação abaixo. Fonte da imagem: `cart.image` (payload) → fallback `yampi_sku_images` por `sku_id` → placeholder. Igual pra todos os papéis.
- Novo bloco **Comercial** (`NegocioComercialCard.tsx`), visível se `isComercial` OU `lead.user_id` preenchido:
  - Sem dono + comercial: botão **Assumir carrinho**.
  - Dono = eu (ou admin): **Gerar cupom** (segmented 5·10·15·20 + validade 1–7 d, default 3) → `functions.invoke('commercial-coupon-create')`; mostra cupom ativo (código com copiar, %, `R$ 159,90 → R$ 127,92`, vence em), e **Abrir conversa** → navega pra `/omni/:peopleId` com `draft` = `message_preview`.
  - Dono = outro (admin vendo): só informa "Em negociação com Fulano desde 09/09 · cupom NOME20".
- Botão "Pausar toques" existente: escondido para comercial (não tem permissão de escrita em `followup_queue`, e a política devolveria erro).

### 4.4 `useSkuImages` — foto da capa sem ler o payload

O payload do carrinho está em `yampi_webhook_events` (pesado, `service_role` only). Por isso o `yampi-process-event` passa a gravar `leads.sku_id` (§2.1) no `carrinho_abandonado`/`checkout_iniciado`, com backfill one-shot dos leads do Loja a partir do último evento de cada `people_id`. `useSkuImages(skuIds[])` faz um `in('sku_id', …)` em `yampi_sku_images` — uma query por board — e o card/detalhe usam o resultado; sem linha no cache → placeholder (o cache é alimentado pelo worker de e-mail, como hoje).

### 4.5 Conversas (`useConversas.ts`)

Sem mudança de código para o escopo — a RLS em `messages`/`clients_people` já recorta a lista. Mudança: ao enviar, o payload pra `whatsapp-outbound` continua igual; a regra do "primeiro WhatsApp humano" é **server-side** (§5.2).

### 4.6 BI

- Sidebar (`DashLayout.tsx`): item BI PRO™ deixa de exigir gestor quando `isComercial` (novo `allowComercial: true` no item). Rota `/bipro` não muda.
- `Dashboard.tsx`: se `isComercial`, só a aba Reconversão renderiza (sem tab bar). Os dados já vêm filtrados pela RLS (`esteira_reconversions.recovered_by = me`; `followup_queue`/`tracked_links` dos leads visíveis).
- `BIProReconversaoTab`: recebe `scope: 'admin' | 'comercial'`.
  - Comercial: `KpiHero` com "Recuperados por você", "Receita recuperada", "Comissão no período" (`Σ commission_value`), "Cupons gerados × usados" (`crm_coupons` dele × `esteira_reconversions.coupon_code ∈ deles`). `FunnelCard`/`ClickRateCard` ficam (fazem sentido pros leads dele). `AttributionCard` mostra base `cupom × janela`. `InsightsStrip` sai.
  - Admin: bloco novo **`CommissionsCard.tsx`** abaixo da tabela — agrupa `esteira_reconversions` do período por `recovered_by` × mês: recuperados, receita, quantos por `cupom`/`janela`, `%` (snapshot médio), comissão (`Σ commission_value`); linha "Esteira automática" (`recovered_by IS NULL`) separada, sem comissão; export CSV (mesmo helper do `ReconversionsTable`). Precisa de `settings_users(id,name)` dos comerciais — admin já pode ler.
- `useReconversaoBI`: acrescenta `recovered_by`, `recovery_basis`, `commission_pct`, `commission_value` ao select e ao agregado (`porComercial`).

### 4.7 Usuários (`EditarUsuarioModal.tsx`, `useUsersNew.ts`)

Campo **Comissão (%)** (`Input type=number step=0.5 min=0 max=100`) visível só com tipo Comercial; grava `settings_users.commission_pct`. Lista de usuários mostra `3% ` ao lado do chip Comercial.

### 4.8 Entrada do comercial

`App.tsx`: o `Navigate` de `/` e do index de `/bipro` vai pra `/bipro/negocios` quando `isComercial` (componente `HomeRedirect`). Sidebar pra ele: Negócios (CRM PRO™), Conversas (OMNI PRO™), BI PRO™. Os demais itens já caem pelo `requireGestor`/módulos.

---

## 5. WhatsApp

### 5.1 Template `minimal_esteira_comercial_cupom`

Adicionado às definições de `bootstrap_wa_templates` (`yampi-connect/index.ts` ~l.537–563), categoria MARKETING, idioma pt_BR:

```
Oi {{1}}, aqui é {{2}} da Minimal Cases 👋
Vi que sua {{3}} ficou separada no carrinho.
Separei um cupom de {{4}}% só pra você: {{5}} — vale até {{6}}.
Quer que eu te ajude a finalizar?
[BOTÃO URL dinâmico] Finalizar com desconto → {{link rastreado}}
```

Exemplos pra Meta: `Gabriella · Hyago · Case Minimal Preta · 20 · GABRIELLA20 · 12/09`. Depois de aprovado, o `whatsapp-templates-sync` o traz pra `whatsapp_templates` como os outros. **Não** cria regra de follow-up (é disparo manual).

`message_preview` (§3.2) é este texto renderizado. Na tela Conversas, quando a janela de 24h está fechada, o envio usa este template com os 6 parâmetros + botão pro `tracked_links` do carrinho (`source:'comercial'`, `label:'cupom'`, `created_by` — nova coluna em `tracked_links`, pra o clique aparecer como "Comercial · cupom" no BI). Janela aberta: texto livre, como hoje.

### 5.2 `whatsapp-outbound` — primeiro WhatsApp humano

Depois do envio bem-sucedido (bloco ~l.1340), se `message_ids` veio preenchido e `messages.user_id` do autor é um `settings_users` com `user_type='comercial'`, e é a **primeira** mensagem humana dele pra esse `people_id` (não existe outra `messages` com `user_id = autor`, `people_id`, `wa_message_id not null`):

1. `UPDATE followup_queue SET status='cancelled', error_message='comercial assumiu o WhatsApp' WHERE lead_id IN (leads da pessoa) AND channel='whatsapp' AND status='pending'`
2. `UPDATE clients_people SET ai_enabled=false WHERE id = people_id`
3. Log `commercial_first_contact { people_id, user_id, cancelled }`.

E-mail e SMS pendentes seguem. Idempotente (segunda mensagem não faz nada).

### 5.3 Trava

Nada muda: `sends_locked` global + allowlist de teste continuam valendo para o comercial. Ele não acessa Integrações (RLS em `omni_channel_configs`: nada).

---

## 6. Testes

**SQL / RLS (Deno test contra o banco via service_role criando 2 comerciais e 1 admin temporários, depois limpa):**
- comercial vê: lead do pool (Loja, stage pool, `created_at = now()-16d`, sem dono); não vê: mesmo lead com 14d; lead de "Validação" com 30d; lead "Recuperado" de outro; lead do pool já assumido por outro; vê o dele em qualquer stage.
- `claim_lead` concorrente (2 JWTs, `Promise.all`) → exatamente um `ok:true`; o outro `ja_assumido`. Lead fora do pool → `fora_do_pool`.
- `clients_people`/`messages` seguem a visibilidade do lead. `esteira_reconversions` só `recovered_by = me`. `omni_channel_configs` → `[]`.
- admin continua vendo tudo (regressão dos 5 acessos).

**Atribuição (unit, `yampi-process-event` com Supabase mockado como nos testes existentes):** cupom de comercial → `cupom`/`recovered_by`/comissão; sem cupom, dono, pago em 6d → `janela`; em 8d → `null`; cupom do comercial A em lead do B → A. `commission_pct` null → `commission_value 0`.

**Cupom:** `createPersonalCoupon` com `source:'agente'` produz exatamente o payload Yampi de hoje (snapshot); `commercial-coupon-create` rejeita 25%, rejeita lead invisível (404), assume lead sem dono, reaproveita cupom ativo.

**`whatsapp-outbound`:** primeiro envio humano de comercial cancela só `channel='whatsapp'` pendentes e desliga IA; segundo envio no-op; envio de admin não cancela nada.

**UI (vitest + RTL, padrão do repo):** `KanbanBoard` agrupa N stages por coluna; comercial sem drag e com botão Assumir; admin com chip do dono; `NegocioComercialCard` nos 3 estados; `CommissionsCard` agrega por comercial × mês e exporta CSV; `Dashboard` só Reconversão pra comercial; `EditarUsuarioModal` mostra comissão só em Comercial.

**Pós-deploy:** `GET /v1/projects/<ref>/advisors/security` → 0 erros (nenhuma tabela nova sem RLS, funções novas com `search_path` e sem EXECUTE pra anon).

---

## 7. Rollout

1. Migration via Management API (padrão do projeto): colunas, stage, funções, RPC, políticas. Backfill `leads.sku_id` no mesmo script.
2. Deploy das functions: `commercial-coupon-create` (nova), `yampi-process-event`, `whatsapp-outbound`, `yampi-connect` (template novo), `ai-agent-execute` (só a extração do cupom).
3. Push na `main` → Vercel.
4. Admin clica "Criar templates na Meta" → aprova `minimal_esteira_comercial_cupom` (minutos a 24h). Até aprovar, "Abrir conversa" com janela fechada fica desabilitado com o motivo.
5. Admin cria o primeiro usuário comercial e define a comissão. O pool começa a aparecer quando os carrinhos do Loja completarem 15 dias (~18/09).

**Fora de escopo (explícito):** relatório de pagamento de comissão (quem já foi pago), metas por comercial, distribuição automática, notificação de novo carrinho disponível, app mobile.
