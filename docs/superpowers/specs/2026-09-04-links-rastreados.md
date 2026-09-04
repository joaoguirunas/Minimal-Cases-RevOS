# Spec — Links rastreados v2: origem por toque, eventos de clique, antibot, UI, agente e BI

**Data:** 04/09/2026 · **Autor:** arquitetura (Growth Sales) · **Executores:** agentes Sonnet 5
**Repo:** `Minimal-Cases-RevOS` (Vite + React 18 + TS + shadcn/Tailwind + TanStack Query v5 · Supabase Postgres + Edge Functions Deno)
**Pedido da cliente (verbatim):** "precisamos planejar a proxima feature, os links enviados pelo agente, templates etc, era legal se conseguirmos enviar um link que consigamos trackear se o cliente clicou etc"

## 1. Problema

Já existe rastreio de clique (`tracked_links` + edge function `r`), mas ele responde só "alguém clicou em algum link desta pessoa". Não responde o que a operação precisa:

1. **Qual toque gerou o clique?** O link não sabe se nasceu do template WhatsApp de 30 min, do e-mail de 48 h ou do botão que o agente mandou. `tracked_links` tem `channel`, mas não tem `followup_queue.id`, `messages.id`, nem template/origem.
2. **Cliques fantasmas.** WhatsApp/Meta, Slack, scanners de e-mail corporativo e prefetch de navegador fazem `GET` na URL para gerar preview. Hoje cada fetch conta como clique e **move o lead para "Engajou"**. Isso contamina o BI (nível "clique" da atribuição) e o kanban.
3. **Só contador.** `clicks`, `first_clicked_at`, `last_clicked_at`. Não dá para ver "clicou 2x, primeiro às 22:31, pelo celular", nem separar humano de robô depois do fato.
4. **Ninguém vê o clique.** Não aparece na timeline do lead (`useEsteiraLead`), no card do kanban (`useEsteiraCardData`), na bolha do inbox, nem na taxa por template no BI. O agente também não sabe que o cliente abriu o carrinho e não comprou.
5. **URL feia.** `https://maigkwlgzinykfvemexf.supabase.co/functions/v1/r?t=…` no botão do template e no e-mail reduz confiança.

## 2. Objetivos

- **O1 · Rastreabilidade por toque:** cada link sabe a origem (`source`), a regra da esteira (`followup_queue_id`), a mensagem (`message_id`), a execução do agente (`execution_id`) e o nome do template (`template_name`). Um clique responde "template WA-01 enviado 03/09 22:14".
- **O2 · Evento por clique:** tabela `tracked_link_clicks` (1 linha por hit) com `is_bot`, `bot_reason`, `is_duplicate`, `device`, `user_agent`, `ip_hash` (nunca IP puro), `referer`, `clicked_at`. Os contadores de `tracked_links` passam a contar **só cliques humanos não duplicados** (semântica melhor para todos os consumidores atuais sem mudar a API deles).
- **O3 · Antibot sem quebrar preview:** crawler/prefetch recebe o mesmo `302`, mas não conta, não carimba `first_clicked_at` e não move o lead.
- **O4 · Redirect rápido:** 1 round-trip ao banco antes do `302` (RPC `record_tracked_click`); progressão de stage e agendamento do agente rodam **depois** da resposta (`EdgeRuntime.waitUntil`). Meta: p95 < 100 ms na função (excluindo latência de rede do cliente).
- **O5 · UI:** clique na timeline do lead; chip "Clicou · há 2h" no card do kanban; "Link aberto 22:31" na bolha do inbox (as duas telas de conversa); card "Taxa de clique por toque" no BI de Reconversão; atribuição exibindo **qual** link converteu. Tudo atualiza sem F5 (realtime em `tracked_link_clicks`).
- **O6 · Agente ciente do clique:** `{{contexto_cliques}}` injetado no prompt ("abriu o link do carrinho (WhatsApp · WA-01) 2x, último há 12 min; não comprou"). Gatilho reativo opcional (desligado por padrão): X min após o **primeiro clique humano** sem compra, agenda um retorno via `ai_scheduled_callbacks` → `ai-callback-worker` → `ai-agent-execute` → `whatsapp-outbound`. **Todas** as travas existentes continuam no caminho.
- **O7 · Base do link configurável:** `TRACKED_LINK_BASE_URL` (secret) com fallback `${SUPABASE_URL}/functions/v1/r`. Domínio curto é decisão da cliente; o resto não depende dele.

## 3. Não-objetivos (fora desta rodada)

- **Auto-embrulhar links colados por operador humano no inbox.** Custo: composer do inbox + policy de INSERT em `tracked_links` para usuários (hoje só `service_role`) ou uma edge function autenticada + UX de toggle. Benefício: baixo — o operador humano manda pouquíssimos links; o volume está nos templates e no agente. Fica para depois; se voltar, a forma certa é uma edge function `tracked-link-create` (JWT do usuário) chamada por um botão "Copiar link rastreado" na aba Esteira.
- Mudar templates Meta aprovados (a URL do botão é fixa na aprovação; trocar domínio exige nova versão + reaprovação).
- Geolocalização por IP, fingerprint, pixel de abertura de e-mail.
- Mobile (`src/components/mobile/*`).
- Retroativo: cliques antigos não ganham linha em `tracked_link_clicks` (a UI faz fallback para `first_clicked_at` dos links legados).

## 4. Decisões de arquitetura (com alternativas rejeitadas)

### D1 · Estender `tracked_links` + nova `tracked_link_clicks` (não substituir)
- **Escolha:** `ALTER TABLE tracked_links ADD COLUMN …` (`source`, `label`, `template_name`, `followup_queue_id`, `message_id`, `execution_id`, `bot_hits`, `nudge_scheduled_at`) e nova tabela filha `tracked_link_clicks`. `clicks/first/last_clicked_at` continuam existindo e passam a significar "humano não duplicado".
- **Rejeitada:** tabela nova `links_v2` e migrar consumidores. Cinco consumidores (`r`, `followup-trigger-worker`, `ai-agent-execute`, `yampi-process-event`, `useReconversaoBI`) já funcionam com a tabela atual; trocar tudo é risco sem ganho.
- **Rejeitada:** só adicionar `user_agent`/`ip` na própria `tracked_links` (última leitura). Perde histórico ("clicou 2x") e não permite reclassificar bot depois.

### D2 · Bot = função pura em `_shared/click-classifier.ts`
- **Escolha:** `classifyClick({ method, userAgent, accept, secPurpose, purpose, xPurpose })` → `{ isBot, reason, device }`. Regras em ordem: método ≠ GET → `method`; UA vazio → `no_ua`; UA casa regex de crawlers/preview/scanners/HTTP libs/headless → `ua`; `Sec-Purpose`/`Purpose`/`X-Purpose`/`X-Moz` contendo `prefetch|preview|prerender` → `prefetch`; `Accept` presente **sem** `text/html` → `accept` (navegador em navegação de topo sempre manda `text/html`; scanners mandam `*/*`). Testada com `deno test` (UA reais: WhatsApp crawler, facebookexternalhit, Slackbot, Chrome Android WebView, Safari iOS, curl, Outlook SafeLinks).
- **Importante:** o navegador embutido do WhatsApp (Android/iOS) **não** manda "WhatsApp" no UA; só o crawler de preview manda (`WhatsApp/2.23…`). Por isso `whatsapp` na regex é seguro.
- **Duplicata:** o mesmo link + mesmo `ip_hash` em < 10 s (Android abre no in-app browser e depois "abrir no Chrome") grava a linha com `is_duplicate=true` e não conta.
- **Rejeitada:** lista de IPs da Meta/Slack. Muda sem aviso, não cobre scanners de e-mail, não cobre prefetch.
- **Rejeitada:** página intermediária com JS ("clique para continuar"). Quebra a experiência do cliente e o preview.

### D3 · Uma RPC para o caminho quente do `/r`
- **Escolha:** `record_tracked_click(token, is_bot, bot_reason, user_agent, ip_hash, referer, device)` (SECURITY DEFINER, só `service_role`) faz SELECT do link + INSERT do clique + UPDATE dos contadores em **uma** chamada e devolve `destination, lead_id, people_id, tracked_link_id, counted, first_human, source`. A função responde `302` logo em seguida; `progressEsteiraStage` e `scheduleClickNudge` vão para `EdgeRuntime.waitUntil` (fallback: `await` se `EdgeRuntime` não existir).
- **Rejeitada:** manter 3–4 chamadas sequenciais via PostgREST (hoje: select, update, select lead, select stages, update lead — antes do 302). É o que faz o redirect passar de 300 ms.

### D4 · Origem ligada em dois pontos (criação + attach)
- O link nasce **antes** da linha em `messages` (template WA: `createTrackedLink` → depois `insert messages`; agente: tool cria link → passo 10c insere a mensagem). Então: `createTrackedLinkDetailed()` devolve `{ id, token, url }` e aceita `source/followupQueueId/executionId/templateName/label`; `attachTrackedLinkMessage(linkId, messageId)` liga depois. `createTrackedLink()` (string) continua existindo como wrapper para não quebrar chamadas.
- **E-mail** não tem linha em `messages` → fica com `followup_queue_id` + `template_name` (nome do template de e-mail ou `subject`).
- **Rejeitada:** guardar `tracked_link_id` em `messages.metadata`. Espalharia a verdade em dois lugares e obrigaria a escrever no jsonb depois do envio; a UI resolve com um `select … where message_id in (…)`.

### D5 · Realtime na tabela de cliques (INSERT), não em `tracked_links`
- **Escolha:** `ALTER PUBLICATION supabase_realtime ADD TABLE tracked_link_clicks`; hook `useTrackedClicksRealtime()` assina INSERT (RLS de SELECT já filtra para usuários ativos), debounce 1,5 s, invalida `['esteira']`, `['tracked-links']`, `['bi-reconversao']`. Volume é baixo (dezenas/dia).
- **Rejeitada:** polling de 5 s nos hooks (custo constante) ou realtime em `tracked_links` UPDATE (dispara também em `bot_hits`).

### D6 · Gatilho reativo reaproveita `ai_scheduled_callbacks`
- **Escolha:** no `waitUntil` do `/r`, se `first_human && counted` e a config `click_nudge_enabled=true` (em `omni_channel_configs.settings` do WhatsApp; **padrão false**), insere `ai_scheduled_callbacks { mode:'agent', reason:'clique_sem_compra', message_text: instrução, scheduled_for: now + click_nudge_delay_minutes (30), whatsapp_template_name: click_nudge_template_name (null) }`. O `ai-callback-worker` já aplica: `ai_enabled`, lead `won/lost`, conversa em andamento, **janela de 24 h do WhatsApp** (`decideDispatch`: fora da janela sem template aprovado → `failed`), e chama `ai-agent-execute` com `stage_trigger`, que passa pelo gate `agent_requires_outreach` e manda por `whatsapp-outbound` (trava `sends_locked` + `test_allowlist`). Adicionamos dois guards específicos: stage do lead ∉ {Pagamento pendente, Recuperado, Perdido} e cancelamento do callback quando a Yampi manda `pix_gerado|pedido_criado|pedido_pago|pedido_cancelado`.
- **Realidade da Meta:** fora da janela de 24 h (cliente não escreveu para nós nas últimas 24 h) só template aprovado sai. Sem `click_nudge_template_name`, o nudge **só dispara para quem já respondeu** — o que já é conversa aberta com o agente. O valor grande vem de (a) o contexto injetado sempre e (b) um template "clicou e não comprou" aprovado pela Meta — decisão da cliente.
- **Rejeitada:** worker novo `click-nudge-worker`. Duplicaria guards, retry, janela de 24 h e cron que já existem no `ai-callback-worker`.
- **Rejeitada:** chamar `ai-agent-execute` direto do `/r`. Sem delay ("não comprou em X min") e sem os guards.
- **Bug lateral corrigido:** `NO_OP_STATUSES` do `ai-callback-worker` não inclui `no_outreach_from_us` → hoje um `200` com esse status é marcado `sent`. Entra na lista.

### D7 · Privacidade (LGPD)
- IP **nunca** é gravado. `ip_hash = sha256(salt | yyyy-mm-dd | ip)[0:32]`; `salt = TRACKED_LINKS_SALT ?? SUPABASE_SERVICE_ROLE_KEY`. Rotação diária impede correlacionar entre dias; o uso é só dedupe/antifraude no mesmo dia.
- `user_agent`, `ip_hash`, `referer` são apagados após **90 dias** (`purge_tracked_click_pii()` via pg_cron 03:17). Contadores e `clicked_at` ficam.
- Base legal: legítimo interesse (medir eficácia da recuperação de carrinho da própria loja). Recomendar à cliente uma linha na política de privacidade ("links de e-mail/WhatsApp registram data/hora e tipo de dispositivo do clique").

## 5. Modelo de dados (DDL resumida — completa na Task 0 do plano)

```sql
ALTER TABLE public.tracked_links
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'outro',        -- esteira_email|esteira_whatsapp|esteira_sms|agente|manual|outro
  ADD COLUMN IF NOT EXISTS label text,                                    -- link_checkout|link_novo_checkout|wa_button_url|cta_voltar_carrinho|yampi_enviar_link_pagamento…
  ADD COLUMN IF NOT EXISTS template_name text,                            -- nome Meta / template e-mail / subject
  ADD COLUMN IF NOT EXISTS followup_queue_id uuid REFERENCES public.followup_queue(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS message_id bigint REFERENCES public.messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS execution_id uuid,
  ADD COLUMN IF NOT EXISTS bot_hits integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nudge_scheduled_at timestamptz;

CREATE TABLE IF NOT EXISTS public.tracked_link_clicks (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tracked_link_id uuid NOT NULL REFERENCES public.tracked_links(id) ON DELETE CASCADE,
  lead_id         uuid,
  people_id       uuid,
  clicked_at      timestamptz NOT NULL DEFAULT now(),
  is_bot          boolean NOT NULL DEFAULT false,
  bot_reason      text,            -- method|no_ua|ua|prefetch|accept
  is_duplicate    boolean NOT NULL DEFAULT false,
  device          text,            -- mobile|desktop|unknown
  user_agent      text,            -- ≤512, apagado após 90d
  ip_hash         text,            -- sha256 com salt diário, apagado após 90d
  referer         text             -- ≤512, apagado após 90d
);

ALTER TABLE public.esteira_reconversions
  ADD COLUMN IF NOT EXISTS attributed_link_id uuid,
  ADD COLUMN IF NOT EXISTS attributed_link_source text,
  ADD COLUMN IF NOT EXISTS attributed_template_name text;

-- RPC record_tracked_click(...)  · purge_tracked_click_pii()  · publication realtime  · RLS igual a tracked_links
```

Índices: `tracked_link_clicks (tracked_link_id, clicked_at desc)`, parciais humanos por `lead_id` e `people_id`; `tracked_links (message_id)`, `(lead_id, created_at desc)`, `(followup_queue_id)`, `(created_at desc)`.

## 6. Fluxos

### 6.1 Criação → envio
```
followup-trigger-worker (WA template)   createTrackedLinkDetailed{source:'esteira_whatsapp', followupQueueId, templateName, label:'wa_button_url'}
                                        → botão URL sufixo = token → insert messages → attachTrackedLinkMessage(link.id, msg.id) + followup_queue.message_id
followup-trigger-worker (e-mail)        {{link_checkout}}/{{link_novo_checkout}} → {source:'esteira_email', followupQueueId, templateName: nome do template|subject, label}
followup-trigger-worker (SMS)           {source:'esteira_sms', followupQueueId, label:'link_checkout'}
ai-agent-execute (tools)                {source:'agente', executionId, label: nome da tool} → ctx.__pending_purchase_url + ctx.__pending_purchase_link_id
ai-agent-execute (passo 10c)            insert messages (cta_url) .select('id') → attachTrackedLinkMessage
```

### 6.2 Clique
```
GET /r?t=TOKEN[?extra]   → parse token · classifyClick(headers) · hashIp
                         → rpc record_tracked_click (1 round-trip)
                         → 302 Location=destination(+extra)  [SEMPRE, bot ou humano; token desconhecido → loja]
                         → waitUntil: se counted && lead_id: progressEsteiraStage('Engajou')
                                      se counted && first_human: scheduleClickNudge (se habilitado)
```

### 6.3 UI / agente / BI
- **Kanban:** `useEsteiraCardData` faz uma 2ª query `tracked_links … in(lead_id) gt(clicks,0)` → `LeadQueueSummary.clicks {total, firstAt, lastAt, links}` → `Chip tone="info"` "Clicou · há 2h".
- **Lead → Esteira:** `useLeadEsteira` lê `tracked_links` + `tracked_link_clicks` do lead → `clicksToTimeline()` → entradas `kind:'clique'` ("Abriu o link · WhatsApp · WA-01 · celular").
- **Inbox (ConversaDetalhes e negocios/conversa/MessageList):** `useTrackedLinksByPerson(peopleId)` → `Map<message_id, link>` → rodapé da bolha "Link aberto 22:31 (2x)".
- **Agente:** `describeClicksForAgent(links, now)` → `ctx.contexto_cliques`, também anexado a `contexto_loja` (o prompt seedado já imprime `{{contexto_loja}}`).
- **BI:** `aggregateClickRates(links)` → card "Taxa de clique por toque" (enviados · clicados · CTR por `source + template_name`); tabela de reconversões mostra "Clique · WA-01" a partir de `attributed_template_name`; funil "clicaram" já usa `first_clicked_at` (agora só humano).
- **Atribuição (yampi-process-event):** `findTrackedClickBefore()` devolve o link mais recente clicado antes do pagamento → grava `attributed_link_id/source/template_name`.

## 7. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Falso positivo do antibot descarta clique humano | Regras conservadoras (lista explícita, sem `bot\b` genérico); `Accept` só como último critério; tudo fica gravado em `tracked_link_clicks` com `bot_reason` → dá para auditar e reclassificar; teste real com o número da allowlist no QA |
| Falso negativo (scanner com UA de navegador, ex.: Microsoft SafeLinks) | Não há solução perfeita; dedupe + `device` + `referer` ajudam a auditar. Medir `bot_hits` vs `clicks` por `source` no BI depois de 2 semanas |
| Redirect lento (RPC + cold start) | 1 round-trip; nada de trabalho antes do `302`; `waitUntil` para o resto; sem `import` dinâmico no caminho quente |
| Privacidade / LGPD | IP nunca gravado; hash com salt diário; purge de 90 dias; texto para política de privacidade |
| Nudge envia mensagem indevida | Desligado por padrão; só primeiro clique humano; só 1 por lead/24 h (`nudge_scheduled_at`); guards do `ai-callback-worker` + stage do lead + cancel em evento Yampi; `sends_locked`/allowlist/`agent_requires_outreach` intactos e **não tocados** |
| Realtime não conectar (RLS, publication) | Hooks continuam funcionando com `staleTime`; log `CHANNEL_ERROR` no console como nos outros hooks |
| Migration em produção (tabela com dados) | `ADD COLUMN IF NOT EXISTS` com DEFAULT constante (rápido no PG ≥ 11); índices `IF NOT EXISTS`; RPC `CREATE OR REPLACE`; nada de `DROP` |
| `tsc` baseline quebrado | Mesma regra do plano anterior: nenhum erro novo nos arquivos tocados |

## 8. Decisões pendentes da cliente

1. **Domínio curto** (ex.: `link.minimalcases.com.br`). Opções: (a) regra de redirect na Cloudflare/DNS (`/<token>` → `…/functions/v1/r?t=<token>`; 1 hop extra ~30 ms; zero código); (b) custom domain do Supabase (add-on pago; URL continua longa `/functions/v1/r`). Depois de escolher: setar `TRACKED_LINK_BASE_URL` e criar **novas versões** dos templates Meta (reaprovação). Até lá o sistema segue com a URL do Supabase.
2. **Gatilho reativo ligado?** `click_nudge_enabled` (padrão desligado), `click_nudge_delay_minutes` (sugestão 30), e — para alcançar quem clicou mas não respondeu — um **template Meta "clicou e não comprou"** (`click_nudge_template_name`), com copy da cliente e aprovação da Meta.
3. **Retenção de UA/hash** (90 dias) e frase na política de privacidade.
4. **Texto do chip/indicador** ("Clicou" vs "Abriu o link") — default "Clicou" no card, "Link aberto" na bolha.

## 9. Adendo (04/09) — aba "Timeline" em Follow-ups

**Pedido:** "onde na UI que consigo configurar os toques, tipo uma timeline etc — precisamos dessa aba dentro dos followups, visão em timeline".

**Hoje:** a configuração dos toques fica em **`/followups` → aba "Etapas CRM"** → expandir o pipeline "Esteira Minimal — Loja" → card de cada stage (`StageFollowupsCard`) lista as regras (`leads_stages_followups`) ordenadas por `dias/horas/minutos`, com canal, template e Ativo/Inativo; "+ Follow-up"/lápis abre o `FollowupModal`. É lista por stage — não há visão da sequência inteira no tempo, nem o status de aprovação do template Meta ao lado do toque (isso está em Configurações → Canais → WhatsApp → Templates, `WhatsappTemplatesConfig`, com o botão que chama `whatsapp-templates-sync`).

**Proposta (Task 13b do plano):** terceira aba **"Timeline"** em `/followups`:
- Seletor de pipeline (default: o que tiver mais regras — a esteira). Para cada stage com regras, uma **linha do tempo horizontal** a partir de "entrou no stage": um marcador por regra na posição do offset (`dias*1440+horas*60+minutos`, escala por stage), ícone do canal, rótulo = template/assunto (`E1`, `WA-01`, `SMS-01`), chips: Ativo/Inativo · **status do template Meta** (Aprovado / Em análise / Rejeitado / Sem template — casado por `whatsapp_template_name` ou `id_template`) · "link rastreado" quando a regra tem `vars.wa_button_url` ou `{{link_checkout}}` no corpo · **CTR do toque** (enviados/clicados por `template_name` em `tracked_links`, quando a feature de links estiver no ar).
- Clique no marcador abre o `FollowupModal` existente (editar); botão "Sincronizar templates com a Meta" reaproveita a ação do `WhatsappTemplatesConfig`.
- Lógica pura e testada: `buildStageTimeline(followups, templates, clickRates)` em `src/lib/followups/timeline.ts`.
- Não muda schema nem edge functions; só leitura de `leads_stages_followups`, `whatsapp_templates`, `tracked_links`.
