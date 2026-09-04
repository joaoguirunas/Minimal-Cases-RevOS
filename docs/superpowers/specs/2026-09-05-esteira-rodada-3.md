# Spec — Esteira rodada 3: timeline de toques, A/B de esteira, WhatsApp com foto, agente com dados do produto, editor de e-mail

**Data:** 05/09/2026 · **Autor:** arquitetura (Growth Sales) · **Executores:** agentes Sonnet 5 em paralelo
**Repo:** `Minimal-Cases-RevOS` (Vite + React 18 + TS + shadcn/Tailwind + TanStack Query v5 · Supabase Postgres + Edge Functions Deno)
**Pedido da cliente (verbatim, `/Volumes/nvme/minimal/tasks.md`):**
1. "Link encurtado + track do agente (acho que esse já está) e Mostrar eventos na timeline"
2. "UI para configuração de toques como timeline dentro da configuração de followups, possibilidade de configuração de fup de whatsapp, email e SMS"
3. "permitir Teste A/B de esteira completa (adicionar isso na UI de configuração de toques)"
4. "Adaptar os templates de whatsapp para termos fup com envio de fotos do anúncio"
5. "Adaptar o agente pra buscar dados do produto do carrinho do usuário para alimentar a conversa"
6. "Trocar template 'celular voando na praia' email, esse título não tá bom"
7. "Editor de email em html + preview no sistema"

**Antecessores:** `2026-09-04-links-rastreados.md` (spec + plano; Task 13b "aba Timeline" desenhada e **não implementada** — evolui aqui) · `2026-09-03-ui-kanban-bi-melhorias.md`.

---

## 1. Problema, item a item (estado verificado em 04/09)

### 1.1 Item 1 — links rastreados: fechar, não refazer
Já existe e está em produção (merge de hoje): `tracked_links` com origem (`source/label/template_name/followup_queue_id/message_id/execution_id`), `tracked_link_clicks` (humano × robô), `/r` com 1 RPC, links do agente rastreados e ligados à mensagem, timeline do lead com `kind:'clique'`, chip "Clicou" no card, "Link aberto" no inbox, CTR no BI, realtime. **Falta só o domínio curto** (`TRACKED_LINK_BASE_URL` já lido por `trackedLinkBaseUrl()`; `buildTrackedUrl()` já gera `/<token>` quando a base não termina em `/r`). Trocar a base muda a URL do botão dos templates Meta → exige **novas versões** dos 6 `mc_*` (decisão da cliente, §8.1). Este documento trata o item como checklist de verificação + tarefa condicional.

### 1.2 Item 2 — configuração dos toques é lista por stage, não linha do tempo
`/followups` → "Etapas CRM" → `StageFollowupsCard` lista as regras de `leads_stages_followups` ordenadas por `dias/horas/minutos`; `FollowupModal` já suporta `whatsapp_template | email | sms`. Lacunas reais:
- **Não há visão da sequência inteira no tempo** (E1 30 min → SMS 2 h → WA 24 h → E2 48 h…), nem por canal, nem status do template Meta ao lado do toque.
- **`vars` da regra não passa pela UI.** `useFollowups.ts` não lê nem grava `vars`; `wa_params`, `wa_button_url`, `cupom`, `cupom_pct`, `expira_horas` só existem porque foram seedados por SQL. Criar um toque WhatsApp novo pela UI hoje gera um template **sem parâmetros de corpo e sem botão rastreado** — o worker manda `{{1..n}}` vazios e a Meta rejeita ("localizable_params does not match").
- Não dá para **mover um toque no tempo** sem abrir o modal e mexer em três selects.

### 1.3 Item 3 — não existe A/B na esteira
`src/types/ab-testing.ts` é do LP PRO (landing pages: `traffic_weight`, `is_control`, `confidence`). Na esteira: nenhuma variante em regras, nenhuma atribuição de lead a variante, nenhuma comparação no BI. Os dois pontos que enfileiram toques (`followup-enqueue` via trigger `notify_lead_stage_changed`, e a RPC `enqueue_stage_followups` para backfill) não sabem o que é variante.

### 1.4 Item 4 — templates WhatsApp sem imagem
`whatsapp-templates-manage` (`create`) repassa `components` direto à Meta e não sabe subir mídia; o `WhatsappTemplateBuilderModal` só oferece header **TEXT**; o `followup-trigger-worker` monta body `{{1..n}}` (de `vars.wa_params`) + botão URL (`vars.wa_button_url`) e **não monta header**; `whatsapp-outbound` repassa `components` como vêm (um parâmetro `{type:'image', image:{link}}` passa intacto — a filtragem só mexe em `type:'text'`). Os 6 `mc_*` aprovados não têm header → versão com foto = template novo + reaprovação. A foto real do SKU já existe (`resolveSkuImage`, cache `yampi_sku_images`, Shopify CDN 500×500) e já vai nos e-mails.

### 1.5 Item 5 — agente sabe o título do produto, não o produto
`ai-agent-execute` monta `ctx.contexto_loja` (~l. 1140–1210): "Carrinho abandonado: {produto} · modelo · total · etapa · pagamento recusado…", último evento, Pix pendente, pedido pago, cliques. **Nada sobre o produto em si** (material, o que vem na caixa, cores/modelos disponíveis, faixa de preço, estoque). `verificar_compatibilidade` consulta `/catalog/skus?q=` a cada pergunta e não tem descrição. O cliente Yampi tem `getProductImages(productId)`; falta `getProduct`. `PersonCart` traz `skuId` mas não `productId` (o webhook traz `sku.product_id`).

### 1.6 Item 6 — título do E2
`email_templates` id `52e679cf-375e-4f6b-98d4-79311abe6702`: name `Esteira · E2 — Celular voando na praia`, subject/`<title>`/h1 "Celular voando na praia. E a gente rindo." (h1 com segunda frase "E ninguém prendendo a respiração."). Tarefa de copy: UPDATE no banco; três opções em §8.4.

### 1.7 Item 7 — editor de e-mail é `Textarea`
`EmailTemplateEditorModal` (243 linhas) já tem: tiptap (`FollowupEmailEditor`) ⇄ "Código HTML" (`Textarea` mono), `VariablePicker`, preview ao vivo em iframe sandbox (`renderPreview` + `buildPreviewDocument`), detecção de variáveis. Faltam: editor de código de verdade (realce, indentação, busca), toggle desktop/mobile no preview, dados de exemplo de um **lead real** (carrinho/foto/modelo), inserir imagem (upload no bucket `email-assets` → `{{asset_base}}/…`), "enviar teste" para um e-mail explícito **respeitando a trava do Klaviyo**, histórico de versões.

---

## 2. Objetivos

- **O1 · Fechar item 1:** checklist de verificação em produção + tarefa condicional "domínio curto" (secret + novas versões dos templates Meta).
- **O2 · Timeline configurável:** aba "Timeline" em `/followups` mostrando, por pipeline e por stage, a sequência de toques no tempo (ícone por canal, rótulo, Ativo/Inativo, status do template Meta, "link rastreado", CTR, imagem no header); **criar** toque clicando na posição do trilho, **mover** por arrastar (snap), **editar** no `FollowupModal`, ligar/desligar inline, duplicar. Raias por variante quando há A/B.
- **O3 · Regras WhatsApp configuráveis pela UI:** `FollowupModal` expõe `vars` (`wa_params` por placeholder `{{n}}`, `wa_button_url`, header de imagem, `cupom/cupom_pct/expira_horas`) e `useFollowups` lê/grava `vars`.
- **O4 · A/B de esteira completa:** experimento por pipeline com N variantes (default A/B 50/50); regras marcadas "comum" ou por variante; lead atribuído **deterministicamente e uma vez** à variante no primeiro enfileiramento; `followup-enqueue` e `enqueue_stage_followups` honram; `followup_queue`, `tracked_links` e `esteira_reconversions` carregam a variante; BI compara leads/toques/CTR/reconversão/receita por variante com indicador de confiança; "promover vencedora" com um clique.
- **O5 · WhatsApp com foto:** criar template com header IMAGE (upload via Resumable Upload API → `header_handle`), enviar com `{type:'header', parameters:[{type:'image', image:{link}}]}` usando (a) foto real do SKU ou (b) imagem fixa por regra, com fallback que nunca deixa o header vazio.
- **O6 · Agente com dados do produto:** `describeProductForAgent()` puro + cache `yampi_products_cache` (24 h) + injeção em `contexto_loja` + tool `consultar_produto` sob demanda + regra no prompt.
- **O7 · E2 renomeado** (decisão de copy da cliente entre 3 opções).
- **O8 · Editor de e-mail:** CodeMirror (HTML) no modo código, preview desktop/mobile, dados de exemplo de lead real, inserir imagem do bucket, enviar teste (edge function com allowlist própria + `sendEmailWithConfig`, que já aplica `isKlaviyoSendLocked`), histórico de versões com restaurar.

## 3. Não-objetivos

- **Mexer em qualquer trava de envio.** `omni_channel_configs.settings.sends_locked/test_allowlist` (WhatsApp), `credentials.sends_locked` (Klaviyo), gate `agent_requires_outreach`, `_shared/whatsapp-send-lock.ts`, bloco "TRAVA DE ENVIO" do `whatsapp-outbound` — nem ler, nem gravar, nem contornar. O teste de e-mail e o teste de WA com foto passam pelos caminhos existentes e **falham** se a trava estiver fechada.
- A/B **multivariado por toque** (variar só o texto de um toque com o resto comum). O modelo permite (regra comum + regras por variante), mas a UI desta rodada é "esteira completa": raias por variante.
- Editor visual drag-and-drop de blocos de e-mail (tipo Klaviyo/Unlayer). Fica tiptap + código.
- Trocar domínio curto sem a cliente decidir (§8.1). Editar templates Meta aprovados "no lugar" (Meta permite 1 edição/dia e reentra em análise; escolhemos versão nova, §4.6).
- Mobile (`src/components/mobile/*`).
- Retroativo: leads que já estão na esteira antes do experimento começar **não** entram no A/B (atribuição só no próximo enfileiramento; §4.3).

---

## 4. Decisões de arquitetura (com alternativas rejeitadas)

### D1 · A/B: experimento por pipeline, variante na regra, atribuição no enfileiramento
- **Modelo:** `esteira_ab_experiments (pipeline_id, status draft|running|paused|finished, winner_variant_id)` · `esteira_ab_variants (experiment_id, key 'A'|'B'…, name, weight %, is_control)` · `leads_stages_followups.ab_variant_id uuid NULL` (**NULL = regra comum a todas as variantes**) · `esteira_ab_assignments (lead_id, experiment_id, variant_id, people_id, bucket)` PK `(lead_id, experiment_id)` · colunas denormalizadas `followup_queue.ab_variant_id`, `tracked_links.ab_variant_id`, `esteira_reconversions.ab_experiment_id/ab_variant_id`.
- **Um único experimento `running|paused` por pipeline** (índice único parcial). Produção e Validação podem ter experimentos independentes.
- **Atribuição determinística** na função SQL `assign_esteira_variant(p_lead_id) → uuid` (SECURITY DEFINER): acha o experimento `running` do pipeline do lead; se já há atribuição, devolve; senão `bucket = ('x' || substr(md5(experiment_id || ':' || coalesce(people_id, lead_id)), 1, 6))::bit(24)::int % 10000` e percorre as variantes em ordem acumulando `weight*100`. Chaveia por **pessoa** (mesma pessoa em dois leads do mesmo experimento → mesma variante). Grava em `esteira_ab_assignments`. Sem experimento `running` → `NULL` (só regras comuns disparam; regras de variante são **puladas**). Uma função só, chamada pelos dois enfileiradores — a verdade não fica duplicada em TS.
- **Onde honrar:** `followup-enqueue` (após carregar o lead: `rpc('assign_esteira_variant')` → filtra `rule.ab_variant_id IS NULL OR = variante` → grava `ab_variant_id` na fila, inclusive para regras comuns, para o BI atribuir toques à variante) e `enqueue_stage_followups` (mesmo filtro no `JOIN`). O `followup-trigger-worker` **não decide nada**: só propaga `entry.ab_variant_id` para `createTrackedLink*`. `yampi-process-event` copia a atribuição para `esteira_reconversions` no pedido pago.
- **Rejeitada:** variante no `leads` (coluna). Um lead pode passar por experimentos sucessivos; a tabela de atribuição guarda histórico e permite BI por experimento.
- **Rejeitada:** duplicar pipeline/stages por variante ("Esteira A"/"Esteira B") e rotear no intake. Quebra kanban, mapeamentos Yampi (`yampi_event_mappings` apontam para um pipeline), agente (`pipeline_ids`) e BI — e a cliente quer testar a esteira *dentro* da mesma esteira.
- **Rejeitada:** sortear em TS no `followup-enqueue` (`Math.random`). Não é reproduzível, não cobre a RPC de backfill e a UI não consegue explicar "por que este lead é B".
- **Rejeitada:** reaproveitar `LpABTest/LpABVariant` (`src/types/ab-testing.ts`). Outro domínio (landing pages, `lp_id`, `traffic_weight` em `lp_ab_variants`). Reaproveitamos os **conceitos** (controle, peso, confiança) e a fórmula de significância (z de duas proporções), não o código nem as tabelas.
- **Encerrar:** `promote_ab_winner(p_experiment_id, p_winner_variant_id)`: regras da vencedora viram comuns (`ab_variant_id = NULL`), regras das outras variantes ficam `active=false`, experimento `finished`. `finish_ab_experiment(p_experiment_id)` (sem vencedora): desativa todas as regras de variante. Atribuições ficam para histórico.
- **Pausar:** `paused` → `assign_esteira_variant` devolve NULL → só regras comuns disparam; leads já atribuídos mantêm a atribuição e retomam quando voltar a `running`.
- **UI:** na aba Timeline, painel "Teste A/B" por pipeline (criar com nome/hipótese/variantes, iniciar/pausar/encerrar/promover). Cada stage mostra raias: **Comum** (sempre) + uma por variante. Uma regra é movida de raia pelo select "Variante" no `FollowupModal` ou pela ação "Duplicar para B" no marcador. O card do kanban/aba Esteira do lead mostram chip "A/B · Variante B".
- **BI:** card "Teste A/B" na aba Reconversão: por variante — leads atribuídos (no período), tocados, links enviados/clicados (CTR), reconvertidos, taxa, receita, ticket; barra comparativa; "confiança" via z de duas proporções (`twoProportionZ`) sobre taxa de reconversão (atribuídos → reconvertidos) — mostra "ainda sem amostra" abaixo de 30 leads por variante.

### D2 · WhatsApp com foto: header IMAGE, upload na criação, `link` no envio
- **Criação (`whatsapp-templates-manage`, ação `create`):** payload ganha `header_image_url` (URL pública, bucket `email-assets`, pasta `wa-headers/`). O servidor baixa a imagem, sobe pela **Resumable Upload API** (`POST /{app_id}/uploads?file_length&file_type` → `POST /{upload_session_id}` com `Authorization: OAuth <token>`, `file_offset: 0`, corpo binário → `{ h }`) e injeta `{ type:'HEADER', format:'IMAGE', example:{ header_handle:[h] } }` no início de `components`. Guarda `json_data.header_image_url` para a UI (o handle não é URL). Precisa do **App ID**: nova coluna `settings_whatsapp_channels.app_id` com fallback secret `META_APP_ID`.
- **Envio (`followup-trigger-worker`):** função pura `buildEsteiraWaComponents({ templateComponents, waParams, waVars, buttonToken, headerImageUrl })` substitui o bloco inline atual. Se o template tem `HEADER format IMAGE`, **sempre** inclui `{ type:'header', parameters:[{ type:'image', image:{ link } }] }`. URL resolvida por `resolveHeaderImage(ruleVars, cart, fallback)`: `vars.wa_header_mode='sku'` → `cart.imagemProduto` → `vars.wa_header_image` → fallback; `'fixa'` → `vars.wa_header_image` → fallback. Fallback = `WA_HEADER_FALLBACK_IMAGE` (secret) ou `${SUPABASE_URL}/storage/v1/object/public/email-assets/prod-fosca.jpg`. Nunca manda header vazio (Meta rejeita). `whatsapp-outbound` **não muda** (já repassa parâmetros não-texto).
- **Rejeitada:** mandar a foto como mensagem de mídia separada depois do template. Fora da janela de 24 h só template sai; a segunda mensagem falharia.
- **Rejeitada:** `media_id` (upload no envio). Um upload por envio; `link` público (Shopify CDN / Storage) é o recomendado pela Meta para template.
- **Política de reaprovação:** versão nova com nome novo (`mc_<nome>_img`), categoria e corpo iguais; a regra continua apontando para o antigo até o novo aparecer **Aprovado** na Timeline (chip), então troca-se o template na regra (um clique no `FollowupModal`). Não editar os aprovados no lugar (Meta: 1 edição/dia, reentra em análise, e a esteira ficaria sem template válido durante a análise).
- **Formato:** JPEG/PNG ≤ 5 MB. A Meta renderiza o header em ~1.91:1; a foto do SKU é 500×500 (fica com barras/crop). Aceitável para "foto do anúncio"; se a cliente quiser arte, usa modo `fixa` com imagem 800×418.

### D3 · Timeline: componente próprio, dados que já existem, offsets em minutos
- **Escala por stage**: `offsetMin = dias*1440 + horas*60 + minutos`; trilho de 0 a `max(maxOffsetMin, 60)`; posição `left = offset/max`. Etiquetas alternam acima/abaixo quando dois marcadores ficam a menos de 6 %.
- **Arrastar** (pointer events, sem lib): ao soltar, `snapOffset(min, maxOffsetMin)` arredonda (≤ 6 h → 5 min; ≤ 2 d → 15 min; acima → 1 h) e `minToParts()` devolve `{dias, horas, minutos}` → `useUpdateFollowupFields({ id, days, hours, minutes })` (PATCH parcial, nunca reescreve a regra inteira). Regras de outro stage não são arrastáveis entre stages (o stage é semântica de negócio).
- **Criar** clicando no trilho vazio: `FollowupModal` ganha `initialOffsetMin` e `initialVariantId`.
- **Rejeitada:** biblioteca de Gantt/timeline (vis-timeline, react-calendar-timeline). Peso e estilo próprios; nosso caso é um eixo por stage com ≤ 10 marcadores.
- **Rejeitada:** salvar layout/ordem manual. A ordem é o próprio offset.
- Lógica pura e testada em `src/lib/followups/timeline.ts` (evolução direta da Task 13b): `buildStageTimeline(followups, templates, clickRates, variants)` → `StageTimeline{ stageId, lanes: Lane[], maxOffsetMin }`, `templateStatusOf`, `formatTempo`, `offsetOf`, `minToParts`, `snapOffset`, `labelPlacement`.

### D4 · `vars` da regra vira formulário
- `useFollowups.ts` passa a mapear `vars` (`Record<string, unknown>`) e `ab_variant_id` nos dois sentidos; `buildInsert` grava `vars` e `ab_variant_id`.
- `src/lib/followups/waRuleVars.ts` (puro): `parseRuleVars(vars) → RuleVars{ waParams: string[]; waButtonUrl: boolean; waHeaderMode: 'sku'|'fixa'|null; waHeaderImage: string|null; cupom; cupomPct; expiraHoras }`, `serializeRuleVars(RuleVars, prev)` (preserva chaves desconhecidas), `bodyPlaceholders(components) → number[]`, `templateHeaderKind(components) → 'none'|'text'|'image'`, `buttonHasDynamicUrl(components)`.
- `FollowupModal` (canal WhatsApp): depois de escolher o template, mostra um select por `{{n}}` do corpo com as variáveis suportadas pelo worker (`nome, remetente, produto, modelo_celular, preco, cupom, expira_em`); switch "Botão com link rastreado do carrinho" (só se o template tem botão URL com `{{1}}`); bloco "Imagem do cabeçalho" (só se `templateHeaderKind === 'image'`): rádio "Foto do produto do carrinho" / "Imagem fixa" + `AssetPicker` (lista do bucket). Seção "Variáveis da regra" (cupom, % do cupom, expira em horas) para todos os canais.
- **Rejeitada:** inferir `wa_params` automaticamente por nome do template. Os `mc_*` usam posicionais `{{1}}`; sem a UI ninguém saberia a ordem.

### D5 · Produto no agente: resumo puro + cache 24 h + tool sob demanda
- `YampiApiClient.getProduct(productId)` → `GET /catalog/products/{id}?include=texts,brand,categories,skus,images`.
- `_shared/yampi-product.ts` (puro, testado): `summarizeProduct(raw) → ProductSummary { id, nome, marca, descricao (texto sem HTML, ≤ 600 chars, corta em frase), categorias[], cores[], modelos[], precoMin, precoMax, variantes: n, semEstoque: string[], imagem }` e `describeProductForAgent(summary) → string` (3–5 linhas em pt-BR). Defensivo quanto à forma da resposta (`x.data` ou array; `variations` array ou `{data}`), porque a doc da Yampi varia.
- Cache `yampi_products_cache (product_id PK, summary jsonb, fetched_at)`, TTL 24 h; `resolveProductSummary(supabase, productId)` (cache → API → upsert). Não generalizar `yampi_sku_images` (chave por SKU, valor = URL; misturar quebraria o `onConflict: 'sku_id'`).
- `PersonCart.productId` (novo) lido de `sku.product_id` do webhook; `resolveCartForPerson` já tem o objeto em mãos.
- `ai-agent-execute`: depois do bloco do carrinho, se `cart.productId` → `linhas.push(describeProductForAgent(...))` (dentro de `contexto_loja`, como `contexto_cliques`). Tool `consultar_produto({ product_id?, pergunta? })`: sem `product_id` usa o do carrinho; devolve o resumo + até 12 variantes (cor/modelo/preço/estoque). Regra no prompt (migration idempotente, mesmo padrão de `20260904110000`): "PRODUTO: use o bloco 'Produto do carrinho'…; para material/medidas/o que vem na caixa chame consultar_produto; nunca invente especificação". `enabled_tools` recebe `consultar_produto`.
- **Rejeitada:** injetar a descrição inteira (HTML da Yampi tem 3–8 KB com imagens). 600 chars + listas cobrem 90 % das perguntas; o resto vai pela tool.

### D6 · Editor de e-mail: CodeMirror por npm, teste com allowlist própria, versões por trigger
- **Editor:** `@uiw/react-codemirror` + `@codemirror/lang-html` (npm; nenhum CDN). Componente `HtmlCodeEditor` (`src/components/ui/html-code-editor.tsx`) usado no `EmailTemplateEditorModal` (modo código) e no `FollowupModal` (corpo manual de e-mail, toggle). Tema segue `dark`/`light` da página via classe do `<html>`.
- **Preview:** toolbar com Desktop (600 px) / Mobile (375 px) — o iframe fica com largura fixa dentro de um contêiner centralizado; `buildPreviewDocument(html, { width })`. "Dados de exemplo": Padrão (SAMPLE_VALUES) ou **Lead real** (busca por nome/e-mail em `clients_people` + `useLeadEsteira`-like: `previewVarsFromLead({ person, cart })` puro devolve `nome, produto, modelo_celular, modelo_celular_curto, imagem_produto, total, preco, link_checkout, cupom…`).
- **Inserir imagem:** botão → upload no bucket `email-assets` (mesma chamada de `EmailAssetsManager`) → insere `<img src="{{asset_base}}/<nome>" width="600" alt="" style="width:100%;max-width:600px;height:auto;">` no cursor (modo código) ou via tiptap `setImage`.
- **Enviar teste:** nova edge function `email-template-test-send` `{ to, subject, html, vars }` — JWT + `settings_users` ativo com `super_admin` ou `user_type='manager'`; **`to` precisa estar em `omni_channel_configs.settings.email_test_recipients`** (canal `email`, lista própria desta feature — chave nova, não é a `test_allowlist` do WhatsApp); prefixa `[TESTE]` no assunto; `html ≤ 200 KB`; despacha com `sendEmailWithConfig` (Klaviyo: `isKlaviyoSendLocked` segue valendo — travado → devolve `KLAVIYO_LOCKED_MSG` e a UI mostra). O front manda as `vars` que já usou no preview (o servidor não recalcula).
- **Rejeitada:** reaproveitar `channel-test-send` (manda um texto fixo, não aceita HTML/vars; mudar a assinatura dele mexe na tela de canal).
- **Histórico:** `email_template_versions (template_id, name, subject, html_body, variables, saved_by, created_at)` alimentada por trigger `BEFORE UPDATE` em `email_templates` quando `subject`/`html_body`/`name` mudam (snapshot do `OLD`, `saved_by = auth.uid()`), mantendo as **30** mais recentes por template. UI: drawer "Histórico" com data/autor/assunto, "Ver" (preview) e "Restaurar" (copia para o editor; salvar gera nova versão).
- **Rejeitada:** versionar no front (localStorage). Não sobrevive a outro usuário.

### D7 · Item 1: só verificação + domínio curto condicional
Nada de código novo além do que a cliente decidir. Com o domínio: (a) regra de redirect na Cloudflare `link.minimalcases.com.br/*` → `https://maigkwlgzinykfvemexf.supabase.co/functions/v1/r?t=$1` (301/302, preserva query), (b) `supabase secrets set TRACKED_LINK_BASE_URL=https://link.minimalcases.com.br`, (c) redeploy de `followup-trigger-worker` e `ai-agent-execute` (leem a env no boot), (d) novas versões dos templates Meta com o botão `https://link.minimalcases.com.br/{{1}}` (podem ser as mesmas versões `_img` do item 4 — **uma reaprovação só**).

---

## 5. Modelo de dados (DDL resumida — completa nas Tasks 0a–0e do plano)

```sql
-- A/B
CREATE TABLE esteira_ab_experiments (id uuid PK, pipeline_id uuid FK leads_pipelines, name text, hypothesis text,
  status text CHECK (draft|running|paused|finished) DEFAULT 'draft', started_at, paused_at, finished_at, winner_variant_id uuid,
  created_by uuid, created_at, updated_at);
CREATE UNIQUE INDEX esteira_ab_one_live_per_pipeline ON esteira_ab_experiments (pipeline_id) WHERE status IN ('running','paused');
CREATE TABLE esteira_ab_variants (id uuid PK, experiment_id uuid FK CASCADE, key text CHECK (key ~ '^[A-Z]$'), name text,
  weight int CHECK (0..100) DEFAULT 50, is_control bool DEFAULT false, position int DEFAULT 0, UNIQUE (experiment_id, key));
ALTER TABLE leads_stages_followups ADD COLUMN ab_variant_id uuid REFERENCES esteira_ab_variants(id) ON DELETE SET NULL;  -- NULL = comum
CREATE TABLE esteira_ab_assignments (lead_id uuid FK leads CASCADE, experiment_id uuid FK, variant_id uuid FK, people_id uuid,
  bucket int, assigned_at timestamptz, PRIMARY KEY (lead_id, experiment_id));
ALTER TABLE followup_queue        ADD COLUMN ab_variant_id uuid;
ALTER TABLE tracked_links         ADD COLUMN ab_variant_id uuid;
ALTER TABLE esteira_reconversions ADD COLUMN ab_experiment_id uuid, ADD COLUMN ab_variant_id uuid;
FUNCTION assign_esteira_variant(p_lead_id uuid) RETURNS uuid          -- SECURITY DEFINER; só service_role
FUNCTION promote_ab_winner(p_experiment_id uuid, p_winner uuid) RETURNS void   -- managers
FUNCTION finish_ab_experiment(p_experiment_id uuid) RETURNS void               -- managers
FUNCTION enqueue_stage_followups(...)  -- CREATE OR REPLACE com filtro de variante

-- WhatsApp com foto
ALTER TABLE settings_whatsapp_channels ADD COLUMN app_id text;      -- Meta App ID (Resumable Upload)
COMMENT ON COLUMN leads_stages_followups.vars IS '… wa_params, wa_button_url, wa_header_mode (sku|fixa), wa_header_image, cupom, cupom_pct, expira_horas';

-- Produto no agente
CREATE TABLE yampi_products_cache (product_id bigint PK, summary jsonb NOT NULL, fetched_at timestamptz DEFAULT now());
UPDATE ai_agents SET general_rules = general_rules || '…PRODUTO:…', enabled_tools = array_append(enabled_tools,'consultar_produto') WHERE …;

-- Editor de e-mail
CREATE TABLE email_template_versions (id bigint identity PK, template_id uuid FK CASCADE, name, subject, html_body, variables text[],
  saved_by uuid, created_at timestamptz);
TRIGGER email_templates_snapshot_version BEFORE UPDATE OF name, subject, html_body ON email_templates;

-- E2
UPDATE email_templates SET name, subject, html_body = replace(replace(...)) WHERE id = '52e679cf-…' AND subject = 'Celular voando na praia. E a gente rindo.';
```

RLS: `esteira_ab_*` SELECT para `settings_users` ativos, escrita para `super_admin`/`manager` e `service_role` (padrão de `email_templates`); `esteira_ab_assignments` e `yampi_products_cache` escrita só `service_role`; `email_template_versions` SELECT ativos, INSERT via trigger (SECURITY DEFINER), DELETE managers.

Índices: `esteira_ab_assignments (experiment_id, variant_id)`, `(people_id)`; `followup_queue (ab_variant_id) WHERE ab_variant_id IS NOT NULL`; `tracked_links (ab_variant_id) WHERE …`; `esteira_reconversions (ab_experiment_id)`; `email_template_versions (template_id, created_at DESC)`.

## 6. Fluxos

### 6.1 A/B — do intake ao BI
```
yampi-process-event.moveLead → UPDATE/INSERT leads (stage)
  → trigger notify_lead_stage_changed → POST followup-enqueue {lead_id, stage_id}
followup-enqueue: lead → rpc assign_esteira_variant(lead_id) → variantId|null
  → regras ativas do stage → filterRulesForVariant(rules, variantId)   (puro: comum sempre; variante só se igual)
  → INSERT followup_queue {…, ab_variant_id: variantId}
followup-trigger-worker: entry.ab_variant_id → createTrackedLink*({ abVariantId })  (só propaga)
yampi-process-event (pedido_pago): SELECT esteira_ab_assignments WHERE lead_id → esteira_reconversions.ab_*
BI: experimento(s) do período + assignments + followup_queue.ab_variant_id + tracked_links.ab_variant_id + reconversions.ab_variant_id
  → aggregateAbTest() → card "Teste A/B"
Encerrar: promote_ab_winner → regras da vencedora viram comuns; perdedoras active=false; status finished
```

### 6.2 WhatsApp com foto
```
UI Builder: header "Imagem" → upload email-assets/wa-headers/<slug>.jpg → header_image_url
whatsapp-templates-manage create: fetch(url) → uploadHeaderHandle(app_id, token, bytes) → h
  → components = [{HEADER IMAGE example.header_handle:[h]}, BODY, FOOTER?, BUTTONS] → Meta → whatsapp_templates (json_data.header_image_url)
whatsapp-templates-sync (já existe): status PENDING → APPROVED
FollowupModal: template com header image → vars.wa_header_mode/wa_header_image
worker: templateHeaderKind(json_data.components)==='image'
  → url = resolveHeaderImage(rv, cart, fallback) → buildEsteiraWaComponents(...) inclui header image + body + button
  → whatsapp-outbound (inalterado) → Meta
```

### 6.3 Produto no agente
```
resolveCartForPerson → PersonCart{ skuId, productId }
ai-agent-execute: cart.productId → resolveProductSummary(supabase, productId)  [cache 24h → GET /catalog/products/{id}]
  → linhas.push(describeProductForAgent(summary)) → ctx.contexto_loja
tool consultar_produto({product_id?}) → mesmo resolve → JSON {resumo, variantes[≤12]}
```

### 6.4 Editor de e-mail
```
EmailTemplateEditorModal: tiptap | HtmlCodeEditor (CodeMirror) → renderPreview(vars) → iframe 600|375
"Dados de exemplo": Padrão | Lead real → previewVarsFromLead(person, cart)
"Inserir imagem" → storage.upload(email-assets) → <img src="{{asset_base}}/…">
"Enviar teste" → email-template-test-send {to, subject, html, vars} → allowlist settings.email_test_recipients → sendEmailWithConfig (lock Klaviyo intacto)
Salvar → UPDATE email_templates → trigger → email_template_versions (snapshot do anterior) → drawer Histórico
```

### 6.5 Timeline (UI)
```
usePipelines + useAllFollowups (com vars, ab_variant_id) + useWhatsappTemplates + tracked_links rates (30d) + useAbExperiments(pipelineId)
  → buildStageTimeline() → por stage: lanes [Comum, A, B] → marcadores
clique no marcador → FollowupModal(followup)        clique no trilho → FollowupModal(initialOffsetMin, initialVariantId)
arrastar → snapOffset → minToParts → useUpdateFollowupFields({days,hours,minutes})
switch inline → useUpdateFollowupFields({active})   "Duplicar para B" → useCreateFollowup({...rule, ab_variant_id: B})
```

## 7. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| **Upload de mídia da Meta** exige App ID e token vinculado ao app (o token do canal é de system user da WABA compartilhada com a Zoppy) | Coluna `app_id` + fallback secret; erro da Meta devolvido legível na UI; QA cria um template de teste `mc_teste_img` antes de mexer nos oficiais; `probe` existente mostra apps inscritos |
| Header IMAGE vazio ou URL inacessível → Meta rejeita o envio | `buildEsteiraWaComponents` nunca omite o header quando o template tem IMAGE; fallback fixo público; teste puro cobre os 4 caminhos (sku/fixa/fallback/sem header) |
| Reaprovação dos templates com foto demora (até 24 h) e a esteira de produção está com regras inativas | Versões novas com nome novo; regras continuam no antigo; chip de status na Timeline; troca é um clique |
| A/B: lead entra na esteira antes do experimento e nunca é atribuído | Atribuição acontece em qualquer enfileiramento (próximo stage); documentado; BI conta só atribuídos; `enqueue_stage_followups` (backfill) também atribui |
| A/B: alguém marca **todas** as regras como variante e pausa o experimento → esteira muda | Pausar mostra aviso "N regras de variante não vão disparar"; `assign` NULL só pula regras de variante; regras comuns seguem |
| A/B: amostra pequena vira "vencedora" por ruído | Card mostra confiança (z de duas proporções) e trava visual "amostra insuficiente" < 30 leads/variante; promover exige confirmação |
| `vars` gravado pela UI sobrescreve chaves que só o SQL conhecia | `serializeRuleVars` faz merge preservando chaves desconhecidas; teste garante |
| Arrastar marcador salva offset errado (fuso/arredondamento) | Offsets são inteiros em minutos, sem data; `snapOffset` + `minToParts` puros e testados; PATCH só de `days/hours/minutes` |
| Yampi `/catalog/products/{id}` com forma diferente da esperada | `summarizeProduct` defensivo (`x.data` ou array), testado com dois formatos; falha → sem bloco de produto, agente segue (try/catch como o resto do contexto) |
| Cache de produto desatualiza preço/estoque | TTL 24 h; `consultar_produto` aceita `force=true` para refazer; estoque por variante ainda vem de `verificar_compatibilidade` na hora |
| Teste de e-mail vira canal de envio indevido | Edge function só aceita destinatários da lista `email_test_recipients`, prefixa `[TESTE]`, exige manager; passa por `sendEmailWithConfig` → trava do Klaviyo intacta |
| CodeMirror aumenta o bundle | Import dinâmico (`React.lazy`) do `HtmlCodeEditor`; só carrega ao abrir o modo código |
| Trigger de versões em `email_templates` dispara em UPDATE de `active` | Trigger `BEFORE UPDATE OF name, subject, html_body` + `IS DISTINCT FROM` |
| `tsc` baseline quebrado | Regra do plano anterior: nenhum erro novo nos arquivos tocados |
| Migration em produção | Tudo `IF NOT EXISTS`/`CREATE OR REPLACE`; nada de DROP; aplicada via Management API pelo controlador |

## 8. Decisões pendentes da cliente

1. **Domínio curto** (item 1): `link.minimalcases.com.br` via regra de redirect na Cloudflare (recomendado, zero código, 1 hop) — sim/não. Se sim, as versões `_img` dos templates (item 4) já nascem com o botão no domínio novo (uma reaprovação só).
2. **Fotos nos templates WA:** modo padrão **foto real do SKU** (500×500, cor exata) ou **arte fixa por toque** (800×418)? Quais dos 6 `mc_*` ganham versão com foto (sugestão: WA-01 e WA-02; PIX-WA sem foto).
3. **A/B inicial:** nome/hipótese do primeiro experimento e o que muda na variante B (ex.: "B = WhatsApp em 2 h em vez de e-mail em 30 min"). Split 50/50. Métrica primária: taxa de reconversão (atribuídos → pagos); secundária: CTR.
4. **Título do E2** (item 6) — escolher 1 (subject · h1 · nome do template):
   - **A** — "Pode derrubar, {{nome}}." · h1 "Pode derrubar. <span>A gente aguenta o tombo.</span>" · `Esteira · E2 — Pode derrubar`
   - **B** — "{{nome}}, para de segurar o celular com medo." · h1 "Para de segurar o celular com medo. <span>Ele está protegido.</span>" · `Esteira · E2 — Sem medo`
   - **C** — "2 metros de queda. Zero drama, {{nome}}." · h1 "2 metros de queda. <span>Zero drama.</span>" · `Esteira · E2 — 2 metros de queda`
   O plano escreve a migration com a **A** e comenta B/C — trocar antes de aplicar.
5. **Lista de e-mails de teste** (`email_test_recipients`): inicialmente `["hyagosilvaxds@gmail.com"]`; quem mais?
6. **App ID da Meta** para o canal (Configurações → Canais → WhatsApp): informar o App ID do app que possui o token do canal.

## 9. Fora do plano, anotado para a próxima rodada
- Template Meta "clicou e não comprou" para o gatilho reativo (spec anterior §8.2).
- Multivariado por toque na UI (o modelo já permite).
- Exportar a Timeline como imagem/PDF para a cliente aprovar a sequência.
