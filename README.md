# RevOS™ by Growth Sales

Plataforma de Revenue Operations para empresas B2B.

Este repositório é uma cópia limpa de outra instalação do RevOS — sem
vínculo com nenhum projeto Supabase, sem segredos, sem dados de negócio.
Este README é o guia completo pra colocar uma instalação nova no ar do zero.

## Módulos

- **CRM PRO™** — Pipeline, qualificação IA, gestão de negócios
- **Omni PRO™** — WhatsApp, Instagram, Email em uma inbox unificada
- **BI PRO™** — Analytics e insights de revenue
- **Call PRO™** — Agendamento e follow-ups automatizados
- **Agentes IA** — Automação conversacional com IA

## Stack

- React + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- Supabase (Database, Auth, Edge Functions, Storage)
- Vercel (Deploy)

---

## Setup do zero

Ordem importa. Siga exatamente nesta sequência.

### 1. Pré-requisitos

- Node.js 18+ e npm
- [Supabase CLI](https://supabase.com/docs/guides/cli) instalada e logada (`supabase login`)
- Uma conta Supabase com um projeto novo criado (Dashboard → New project)

### 2. Ligar o repo ao projeto Supabase novo

```sh
npm install
supabase link --project-ref <seu-project-ref>
```

O `<seu-project-ref>` é o identificador do projeto (aparece na URL do
dashboard e em Settings → General).

**Se `supabase link` (ou qualquer `supabase db query --linked`) falhar
com `"Your account does not have the necessary privileges to access
this endpoint"`**: a conta logada no CLI não é membro da organização
Supabase dona desse projeto — isso é comum quando o projeto foi criado
por outra pessoa/conta (o cliente, uma agência, etc). Duas saídas:
1. Peça pra ser adicionado como membro da organização
   (Dashboard → Organization → Team), ou
2. Use conexão direta ao Postgres em vez de `--linked` — pega a senha
   do banco em Settings → Database → Connection string, e troque todo
   `supabase db query --linked -f arquivo.sql` deste guia por:
   ```sh
   PGPASSWORD='<senha-do-banco>' psql -h db.<seu-project-ref>.supabase.co -p 5432 -U postgres -d postgres -v ON_ERROR_STOP=1 -f arquivo.sql
   ```
   (`psql`, não o `supabase db query --db-url`, que não roda arquivos
   com múltiplos comandos — o driver que ele usa não suporta multi-statement
   em prepared statement.) **Isso não resolve o deploy de edge functions**
   (passo 5) nem `supabase functions deploy`, que exigem acesso de
   organização de qualquer forma — só a etapa de banco.

Depois de linkar, edite estes dois arquivos e troque o placeholder pelo
seu `project-ref` real (não afeta nada crítico se esquecer, mas mantém
tooling e MCP corretos):

- `supabase/config.toml` → `project_id = "..."`
- `.mcp.json` → `project_ref=...`

### 3. Aplicar o schema

**Não use `npm run db:push` nem `supabase migration up`** — este CLI
(v2.105) pula silenciosamente qualquer migration cujo nome não tenha
underscore logo após o timestamp (boa parte das ~891 migrations
antigas usa hífen), e o histórico completo tem uma dúzia de bugs
antigos (sintaxe inválida, tabelas que só existiram no Studio e nunca
foram versionadas) que travam um replay migration-por-migration. As
891 migrations continuam no repo como histórico/auditoria, mas o
caminho de setup real é aplicar o **dump do schema atual** direto:

```sh
supabase db query --linked -f supabase/schema.sql
supabase db query --linked -f supabase/seed.sql
```

(sem acesso de organização, use `psql -f` como descrito no passo 2)

`schema.sql` é um dump limpo (`supabase db dump --schema public`) do
estado final real — sem os bugs históricos. `seed.sql` é só o genérico
(módulos do sistema, bucket de storage, motivos de perda padrão), sem
nenhum dado de negócio.

**3a. Extensões que o dump de schema não inclui** (`pg_cron`/`pg_net`
vivem fora do schema `public`):

```sh
supabase db query --linked "CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog; CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA public;"
```

**3b. Criar o secret do Vault que os cron jobs usam pra se autenticar:**

No Supabase Dashboard → Settings → API, copie a **service_role key** do
seu projeto novo. Depois:

```sh
supabase db query --linked "SELECT vault.create_secret('<sua-service-role-key>', 'service_role_cron', 'Service role JWT for pg_cron secure_http_post calls');"
```

**3c. Rodar `supabase/bootstrap.sql`** — abra o arquivo, troque os
placeholders `__SUPABASE_URL__` pela URL real do seu projeto
(`https://<seu-project-ref>.supabase.co`), e rode:

```sh
supabase db query --linked -f supabase/bootstrap.sql
```

Isso aponta `_app_config` pro seu projeto, sincroniza a
`service_role_key` a partir do Vault e recria os 7 cron jobs internos
(sync de templates WhatsApp, watchdog do agente de IA, follow-ups de
reunião, dispatch de campanhas, reconciliação Kiwify, callback de IA)
já com a URL certa.

Valide tudo de uma vez:

```sh
supabase db query --linked "SELECT * FROM public.trigger_fwup01_smoke_test();"
```

Todos os checks devem voltar `PASS`.

### 4. Variáveis de ambiente do frontend

```sh
cp .env.example .env
```

Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (Settings → API
do seu projeto). O resto é opcional — só preencha se for usar login/OAuth
Google ou Microsoft.

```sh
npm run dev
```

### 5. Deploy das Edge Functions

**Exige acesso de organização no Supabase** — ao contrário do passo 3
(banco, contorna com `psql` + senha), não existe alternativa por
conexão direta pra isso. Se `supabase functions deploy` (mesmo com
`--project-ref` explícito) devolver `403: Your account does not have
the necessary privileges`, a conta do CLI precisa ser adicionada como
membro da organização dona do projeto primeiro
(Dashboard → Organization → Team → Invite).

**O plano Free do Supabase tem um teto rígido de 100 edge functions por
projeto** (erro `402: Max number of functions reached`), e este repo
tem 103. `supabase functions deploy` sem argumento tenta subir tudo de
uma vez só e falha por completo se estourar o teto — nada fica no ar
nem no meio do caminho.

Se estiver no Free e quiser as 103, faça upgrade do plano ou ative o
spend cap antes (Supabase Dashboard → Settings → Billing) e então rode:

```sh
supabase functions deploy
```

Se for ficar no Free, deploye em lotes explícitos (o comando aceita
vários nomes) até faltar só o que você não vai usar — normalmente é
mais fácil deixar de fora uma integração inteira que você não usa
(ex: Zoom = `zoom-connect`, `zoom-token-refresh`, `zoom-upsert-event`,
3 functions) do que ficar testando lote por lote:

```sh
supabase functions deploy fn-1 fn-2 fn-3 ... --use-api
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são
injetadas automaticamente pelo runtime — não precisa configurar.

**Secrets opcionais**, configure só o que for usar (canal por canal):

```sh
supabase secrets set WHATSAPP_ACCESS_TOKEN=... WHATSAPP_APP_SECRET=... WHATSAPP_VERIFY_TOKEN=...
supabase secrets set INSTAGRAM_ACCESS_TOKEN=... INSTAGRAM_APP_ID=... INSTAGRAM_APP_SECRET=... INSTAGRAM_BUSINESS_ID=... INSTAGRAM_PAGE_ID=... INSTAGRAM_VERIFY_TOKEN=...
supabase secrets set TIKTOK_APP_ID=... TIKTOK_APP_SECRET=... TIKTOK_BUSINESS_APP_ID=...
supabase secrets set OPENAI_API_KEY=...            # agentes de IA
supabase secrets set RESEND_API_KEY=...            # envio de email
supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=...   # Google Calendar/Ads
supabase secrets set ZOOM_CLIENT_ID=... ZOOM_CLIENT_SECRET=...
supabase secrets set MS_CLIENT_ID=... MS_CLIENT_SECRET=...           # Microsoft/Teams
supabase secrets set CALCOM_CLIENT_ID=...
supabase secrets set KIWIFY_BASE_URL=...
supabase secrets set APP_URL=... SITE_URL=...       # URL pública do frontend, pós-deploy
```

Segredos internos de assinatura de webhook (gere valores aleatórios
fortes, não são de nenhum provedor externo):
`ATENDE_WEBHOOK_SECRET`, `BOOKING_CAPABILITY_SECRET`,
`ELEVENLABS_WEBHOOK_SECRET`, `SEND_CALLBACK_SECRET`.

### 6. Criar o primeiro usuário admin

O app não tem tela de "primeiro admin" — a criação de usuário
(`create-global-user`) exige um admin já autenticado (proteção correta
contra escalonamento de privilégio). Pro **primeiro** usuário, faça manual:

1. Supabase Dashboard → Authentication → Users → Add user (email + senha)
2. Copie o `User UID` gerado
3. Rode:

```sh
supabase db query --linked "INSERT INTO public.settings_users (auth_user_id, name, email, user_type, super_admin, active) VALUES ('<user-uid>', 'Seu Nome', 'seu@email.com', 'admin', true, true);"
```

A partir daqui, esse usuário consegue logar no app e criar os demais
pela própria interface.

### 7. Deploy do frontend (Vercel)

```sh
git init
git add -A
git commit -m "Initial commit"
```

Suba pra um repositório novo no GitHub/GitLab e conecte na Vercel
(`vercel.json` já está configurado). Configure as mesmas variáveis do
passo 4 (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, etc.) nas
environment variables do projeto Vercel.

---

## O que NÃO veio nesta cópia (de propósito)

- Nenhum dado de negócio: sem leads, pipelines, agentes de IA, templates
  de WhatsApp, campanhas. O banco novo nasce só com schema
  (`supabase/schema.sql`) + os seeds genéricos em `supabase/seed.sql`
  (motivos de perda padrão, módulos do sistema, bucket de storage).
  Note que `omni_channel_configs` e `settings_omni_new_contact` foram
  deixados de fora do seed de propósito — na instalação de origem eles
  tinham credenciais reais e IDs de pipeline específicos; configure os
  canais pela própria interface do CRM.
- Nenhuma credencial: `.env`, `.env.local`, `.env.migration` não foram
  copiados (ficam de fora do git também, veja `.gitignore`).
- Sem histórico git — este repo nasce com `git init` limpo.
- `scripts/migrate-config.ts` (ferramenta pra clonar configuração de
  pipelines/agentes/etc entre dois projetos Supabase) veio no repo mas
  está **desatualizada** (referencia tabelas antigas `crm_pipelines`/
  `crm_stages`, hoje renomeadas para `leads_pipelines`/`leads_stages`).
  Só mexa nela se for realmente clonar config de outra instalação —
  não é necessária pra este setup do zero.
- A tool de IA `enviar_audio_convite_growth_experience`
  (`supabase/functions/ai-agent-execute`) ficou com URLs placeholder —
  é um exemplo de tool com asset fixo (áudio + link de evento); troque
  pelos seus próprios antes de ativar esse fluxo especificamente.

### Bugs históricos corrigidos nas 891 migrations (não afetam o setup real)

Ao tentar validar o replay migration-por-migration deste histórico
(mantido no repo por auditoria, não é o caminho de setup — ver seção
3 acima), apareceram alguns bugs antigos, todos em tabelas/módulos já
abandonados/substituídos no schema atual, sem efeito no resultado
final. Corrigidos direto nos arquivos, pra quem for usar o histórico
pra debug algum dia:

- `20250706045238-...-ok.sql` — `DROP POLICY ... FOR INSERT/UPDATE/DELETE`
  é sintaxe inválida (faltava separar em `DROP` + `CREATE POLICY`).
- `20250709020606-...-ok.sql` em diante — `crm_pessoas.status_atendimento`
  nunca foi criada por uma migration rastreada (feita fora de banda,
  provavelmente via Studio); patch em
  `20250709020605_baeta_patch_status_atendimento.sql`.
- `20250713132254`, `20250716155825`, `20250716231134`,
  `20250716233135` — módulo de "reservas" (`crm_reservas_*`), mesmo
  padrão: tabelas nunca versionadas, neutralizadas (viram no-op).
- `20250717194829-...-ok.sql` — `CREATE INDEX CONCURRENTLY` não roda
  dentro de transação; removido o `CONCURRENTLY` (irrelevante em banco
  novo vazio).
- `20250723032042-...-ok.sql` — `CREATE POLICY` duplicada (commit
  quase idêntico 2 minutos depois do anterior); adicionado
  `DROP POLICY IF EXISTS` antes.

### Outros ajustes encontrados no deploy real

- `supabase/config.toml` tinha 3 entradas (`nylas-auth-connect`,
  `nylas-events-sync`, `nylas-availability`) sem pasta correspondente
  em `supabase/functions/` (já não existiam nem no repo de origem);
  removidas, senão `supabase functions deploy` falha procurando um
  `index.ts` que não existe.
- `kiwify-inbound/index.ts` e `kiwify-reconcile/index.ts` importavam
  `@supabase/supabase-js` via alias do `deno.json` (`imports` map).
  O deploy via `--use-api` não resolve esse alias e falha no bundle;
  trocado pro import direto (`https://esm.sh/@supabase/supabase-js@2`),
  igual ao resto das functions.
- Quando o projeto Supabase pertence a uma organização da qual a conta
  do CLI não é membro, `supabase link`/`db query --linked`/`functions
  deploy` falham com `403`. Pra banco existe contorno via `psql` direto
  (ver passo 2); pra edge functions não existe — precisa de convite na
  organização.

## Deploy

Push para `main` — Vercel deploya automaticamente (depois de conectado
no passo 7).

## Integração Yampi (YMP)

Conecta a loja Yampi (checkout da Shopify Minimal Cases) ao CRM.

- **Config no painel**: Configurações → Integrações → Yampi (alias + User-Token +
  User-Secret-Key, de Perfil → Credenciais de API no painel Yampi). O `connect`
  registra automaticamente um webhook com `cart.reminder`, `order.created`,
  `order.paid`, `order.status.updated` e `transaction.payment.refused`, e guarda a
  `secret_key` para validar o header `X-Yampi-Hmac-SHA256` (enforcement ligado).
- **Fluxo**: `yampi-inbound` (público) persiste em `yampi_webhook_events` de forma
  idempotente e enfileira `yampi-process-event`, que resolve/cria o contato em
  `clients_people` por e-mail/telefone (com auto-merge) e marca o evento processado.
- **Tools do agente IA** (`ai-agent-execute`): `yampi_enviar_link_carrinho`,
  `yampi_enviar_link_pagamento` (checkout novo, com cupom opcional),
  `yampi_consultar_pix_pendente`, `yampi_criar_cupom` (cupom personalizado com o
  nome do cliente, 5/10/15%, uso único, validade curta) e `yampi_consultar_pedido`
  (status + rastreio).
- **Deploy**: `supabase functions deploy yampi-connect yampi-inbound yampi-process-event ai-agent-execute`
  (config.toml já marca `yampi-inbound`/`yampi-process-event` com `verify_jwt=false`).
  Migration: `supabase/migrations/20260830150000_yampi_integration.sql`.
- **Testes**: `deno test supabase/functions/yampi-inbound/logic.test.ts`.

## Templates de e-mail Minimal (EMAIL-2.1) + Reestilização (MC-1)

- **Templates**: a migration `20260830160000_minimal_email_templates_seed.sql` insere os
  6 e-mails da esteira de carrinho abandonado da Minimal Cases (E1–E6) em
  `email_templates` — editáveis com preview ao vivo em Configurações → Integrações →
  E-mail → Templates. As imagens ficam em `public/email-assets/` e os templates
  referenciam `{{asset_base}}`; no envio real, defina `asset_base` como a URL pública
  do deploy (ex. `https://crm.suaurl.com/email-assets`). No preview isso já resolve
  sozinho para `/email-assets`.
- **Tema Minimal**: tokens de cor (`src/index.css`), fontes (Archivo + IBM Plex Mono),
  logo (`GrowthSalesLogo.tsx` agora renderiza a marca Minimal Cases; assets em
  `public/logos/minimal-*.png`), favicon e metas (`index.html`). Paleta: papel
  `#f6f5f2` / ink `#121212` / laranja `#e8632b` no claro; `#0d0d0d` / `#161616` /
  bone `#f2f0eb` no escuro.

### Esteira da loja (YMP-4)
Migration `20260830170000_yampi_pipeline_mappings.sql` cria o pipeline
**"Esteira Minimal — Loja"** (7 stages: Entrou no checkout → Carrinho abandonado →
Pix/boleto gerado → Pedido criado → Pagamento recusado → Compra finalizada →
Cancelado), a tabela `yampi_event_mappings` (evento → pipeline/stage, editável na
UI da integração Yampi, seção "Esteira") e o cron `yampi_reconcile` (5 min).

- `yampi-process-event` agora move/cria o lead do contato no stage mapeado, com
  precedence guard por pedido/carrinho (evento atrasado nunca regride o lead) e
  valor do lead = total do carrinho/pedido.
- **Entrou no checkout**: a Yampi não tem webhook para isso — `yampi-reconcile`
  varre `GET /checkout/carts` (janela deslizante) e sintetiza `checkout_iniciado`
  assim que o cliente se identifica no checkout; o lead aparece na esteira na hora.
  Também reenfileira eventos presos. Deploy: `supabase functions deploy yampi-reconcile`
  (SEM --no-verify-jwt; requer o Vault secret `service_role_cron`, como o Kiwify).

### Follow-up de e-mail nos stages (EMAIL-3)
No modal de follow-up de etapa (Follow-ups → etapa → novo), o canal E-mail agora
aceita **template da biblioteca** (`email_templates`, com preview) além do corpo
manual — o vínculo vai em `leads_stages_followups.email_template_id` e o
`followup-trigger-worker` já dava precedência ao template no envio. O modal também
mostra o status das credenciais do canal (provedor/from de `omni_channel_configs`,
channel=email — configuradas em Configurações → Integrações → E-mail) e avisa
quando o canal está inativo. Para os templates da esteira Minimal, defina o secret
`EMAIL_ASSET_BASE` nas edge functions (URL pública de `/email-assets`):
`supabase secrets set EMAIL_ASSET_BASE=https://<seu-deploy>/email-assets`.
