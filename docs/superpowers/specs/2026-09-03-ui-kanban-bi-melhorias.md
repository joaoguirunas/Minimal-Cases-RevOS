# Spec — Melhorias de UI: Kanban, BI de Reconversão e aba Esteira

**Data:** 03/09/2026 · **Autor:** arquitetura (Growth Sales) · **Executores:** agentes Opus 5
**Repo:** `Minimal-Cases-RevOS` (Vite + React 18 + TS + shadcn/Tailwind + TanStack Query + recharts + framer-motion + @hello-pangea/dnd)
**Design system:** tokens em `src/index.css` (paper `#f6f5f2` / ink `#121212` / bone `#f2f0eb`), `--radius: 0.75rem`, fonte Archivo + IBM Plex Mono, botões pill (`primary` = ink no claro, bone no escuro). Referência visual: página **Integrações → Yampi** (cards `rounded-xl border-border bg-card p-5`, chips `rounded-full`, textos `text-[12–13px]`).

## 1. Diagnóstico (o que está pouco intuitivo hoje)

### Kanban (`src/components/negocios/KanbanBoard.tsx`, `StageColumn.tsx`, `NegociosToolbar.tsx`)
1. **Card sem hierarquia**: nome + empresa (irrelevante para loja) + valor, e uma linha de até **9 chips** de cores diferentes (não lidas, score, msgs, UTM, e-mail, WhatsApp, SMS, cursos, tags, dias). Nada diz *qual produto* nem *o que acontece a seguir*.
2. **Sem noção de progresso da esteira**: chips de toques mostram só o que foi enviado; não mostram quantos faltam nem quando é o próximo.
3. **Cabeçalho da coluna** mostra só nome, contagem e soma. Sete colunas iguais; não há como recolher as vazias nem ver a distribuição do funil de uma vez.
4. **Toolbar com ~15 selects em linha** (Pipeline, Etapa, Status, Data, Equipe, Responsável, 5 UTMs, Score, Motivo, Produto, Tags, Canais) — a maioria nunca usada na operação da loja. Filtros ativos não ficam visíveis como chips.
5. Drop-target quase invisível (`bg-accent/5`), skeleton genérico, cards não navegáveis por teclado.

### BI de Reconversão (`src/components/dashboard/BIProReconversaoTab.tsx`, `src/hooks/useReconversaoBI.ts`, `src/pages/Dashboard.tsx`)
6. **Seis KPIs do mesmo tamanho** em duas linhas: não há hierarquia (receita recuperada deveria ser o herói).
7. **Sem comparação**: nenhum delta vs. período anterior; o número sozinho não diz se está bom.
8. **Sem funil**: não se vê tocados → clicaram → pagaram nem a receita por nível de atribuição (cupom/clique/janela/orgânico).
9. Gráfico diário só de contagem, tooltip com `borderRadius: 4` (fora do design), sem receita.
10. **Tabela sem filtro/ordenação/exportação**, linhas não clicáveis, sem paginação.
11. **Período padrão "hoje"** → BI abre vazio quase sempre (a esteira roda em janelas de 7 dias).

### Aba Esteira do lead (`src/components/negocios/NegocioEsteira.tsx`)
12. Timeline sem separação por dia, sem "próximo toque", sem ação (pausar toques, copiar link). Card do carrinho sem imagem nem variação (cor/modelo).

### Sistema de design
13. Chips e KPI cards são strings de classe repetidas em 3 arquivos (StageColumn, BI tab, readiness). Nenhuma primitiva `Chip`/`StatCard`. Sem tema de gráfico compartilhado nem tokens `--chart-*`.

## 2. Princípios de design para esta rodada
- **Uma coisa por linha no card**: quem · o quê · quanto · onde está na esteira · quando é o próximo passo.
- **Hierarquia por tamanho, não por cor**: cor só para estado (atenção/sucesso/erro). Chips neutros por padrão.
- **Progresso sempre visível**: "3 de 8 toques · próximo E2 em 3h" vale mais que três chips coloridos.
- **Comparar antes de mostrar**: todo KPI principal com delta vs. período anterior.
- **Raio 12 px em tudo**, tooltips de gráfico incluídos. Fonte mono só para números/códigos.
- **Acessível**: foco visível, `aria-label`, `prefers-reduced-motion` respeitado.

## 3. Melhorias (com critérios de aceite)

### A. Fundações do design system
- **A1 `Chip`** (`src/components/ui/chip.tsx`): `tone: neutral|info|success|warning|danger|violet`, `size: sm|md`, `icon?`, `title?`. Substitui todas as strings inline de chip em `StageColumn.tsx` e `BIProReconversaoTab.tsx`. *Aceite:* zero ocorrências de `rounded-full border leading-none` inline nesses dois arquivos.
- **A2 `StatCard`** (`src/components/ui/stat-card.tsx`): `size: hero|default|compact`, `label`, `value`, `sub?`, `delta?: { value: number; label: string }` (verde ↑ / vermelho ↓ / neutro), `icon?`, `children?` (slot para sparkline). *Aceite:* usado em todos os KPIs do BI.
- **A3 Tema de gráfico** (`src/lib/chartTheme.ts` + tokens `--chart-1..5` em `index.css` claro/escuro): `tooltipStyle` (raio 12, borda, fundo card), `axisTick`, `gridStroke`, paleta. *Aceite:* nenhum `borderRadius: 4` em gráficos.
- **A4 Testes**: Vitest configurado; funções puras (agregações, formatadores) testadas.

### B. Kanban
- **B1 Card redesenhado** (`StageColumn.tsx`): linha 1 nome + valor; linha 2 produto (título do lead antes do " — ") em `text-muted-foreground`; linha 3 barra de progresso da esteira (`enviados/total`) + texto "próximo: E-mail em 3h" (ou "esteira concluída" / "sem toques"); linha 4 chips: dias no funil (neutro <3d, âmbar ≥3d, vermelho ≥7d), não lidas (vermelho), tags (máx. 2 + "+n"). Removidos do card: empresa, UTM, score, cursos, contagem de msgs (ficam no detalhe). *Aceite:* card com no máximo 4 chips; `useEsteiraCardData(leadIds)` fornece `sent/total/nextAt/nextChannel` em uma query.
- **B2 Coluna**: cabeçalho com nome, contagem, soma e **% dos leads do pipeline**; botão recolher (persistido em `localStorage` por pipeline) que vira uma faixa vertical de 40 px com nome girado e contagem; drop-target `ring-1 ring-primary/30 bg-primary/[0.03]`; skeleton com anatomia do card. *Aceite:* recolher/expandir sobrevive ao reload.
- **B3 `PipelineFunnelStrip`** (novo, acima das colunas): barra segmentada horizontal com um segmento por stage (largura ∝ leads, cor do stage, rótulo `nome · n`), clicável → aplica `stageFilter`; segmento ativo destacado. *Aceite:* soma dos segmentos = total de leads exibidos.
- **B4 Toolbar**: linha primária = modo de visualização · Pipeline · Busca · Status · Período · botão **"Filtros (n)"**; os demais (Equipe, Responsável, UTMs, Score, Motivo, Produto, Tags, Canais) ficam num `Popover` em grade 2 colunas; abaixo da toolbar, **chips dos filtros ativos** com × e "Limpar tudo". *Aceite:* nenhuma prop removida da API do `NegociosToolbar`; largura da toolbar cabe em 1280 px sem scroll horizontal.
- **B5 A11y**: card com `tabIndex=0`, `role="button"`, Enter/Espaço abre; `aria-label` "Lead X, R$ Y, 3 de 8 toques".

### C. BI de Reconversão
- **C1 Hook**: extrair `aggregateReconversao(rows, touches, clicks, prevRows)` puro em `src/lib/bi/reconversao.ts` (testado). Novos campos: `anterior` (mesmos KPIs do período anterior de igual duração), `deltas`, `funil { tocados, clicaram, pagaram }`, `porNivelReceita`, `porCanalUltimoToque`, `porDia[].receita` já existe.
- **C2 Layout herói**: linha 1 = `StatCard size=hero` "Receita recuperada" (valor grande, delta, sparkline dos últimos dias) + 2 cards default ("Reconvertidos" com mini barra empilhada cupom/clique/janela; "Taxa de reconversão" com denominador e delta). Linha 2 = 3 `compact` (Leads tocados, Toques por canal, Tempo até converter).
- **C3 Funil + atribuição**: card com funil horizontal de 3 etapas (tocados → clicaram → pagaram, % entre etapas) e card com barra empilhada de receita por nível (cupom/clique/janela/orgânico) com legenda.
- **C4 Série diária**: `ComposedChart` — barras de receita (muted) + linha de reconversões (primary), eixo direito para receita, tooltip do `chartTheme`, estado vazio com texto orientado à ação.
- **C5 Tabela**: chips-filtro (Todos · Atribuídos · Orgânicos · por nível), ordenação por valor/data (cabeçalho clicável), paginação 25/página, linha clicável → `/crm/kanban/{lead_id}` quando houver, botão "Exportar CSV" (client-side).
- **C6 Insights**: faixa com até 3 frases geradas dos dados (ex.: "VOLTA10 respondeu por 62% da receita recuperada", "WhatsApp foi o último toque em 4 de 7 recuperações", "Tempo médio até pagar caiu 30% vs. período anterior"). Só frases com dado suficiente (n ≥ 3).
- **C7 Período**: novo preset `30d` em `Dashboard.tsx`; padrão da aba Reconversão = `30d`.

### D. Aba Esteira do lead
- **D1 Cabeçalho**: progresso (`n de N toques`), "próximo toque: E3 · amanhã 10:00", botões "Pausar toques" (cancela pendentes, com confirmação) e "Copiar link do carrinho".
- **D2 Timeline** agrupada por dia (separador "Hoje", "Ontem", "dd/MM"), hora relativa nos toques ("há 2h"), nome do template quando houver.
- **D3 Carrinho**: miniatura da imagem do SKU (quando o payload trouxer), chips de variação (Cor · Modelo) e etapa de abandono (cadastro/frete/pagamento).

## 4. Fora de escopo
Kanban virtualizado, edição inline de valor no card, novas fontes de dados no BI (Klaviyo/Meta), mobile (`src/components/mobile/*`), mudanças no schema do banco (exceto nenhuma — tudo é leitura das tabelas existentes: `leads`, `followup_queue`, `esteira_reconversions`, `tracked_links`, `yampi_webhook_events`).

## 5. Riscos e mitigação
- `tsc` do repo **não passa no baseline** (dezenas de erros pré-existentes). Critério: nenhum erro **novo** nos arquivos tocados (comparar com `git stash`).
- `eslint` tem `no-explicit-any` pré-existente em vários arquivos: não introduzir `any` novos.
- RLS: o cliente lê `followup_queue`, `tracked_links`, `esteira_reconversions` (policies de select para usuários ativos existem). "Pausar toques" faz `update` em `followup_queue` — se a policy negar, a ação deve mostrar erro claro (não silenciar).
- Performance: hooks por lista de leads devem fazer **uma** query com `.in('lead_id', ids)`; nunca uma por card.
