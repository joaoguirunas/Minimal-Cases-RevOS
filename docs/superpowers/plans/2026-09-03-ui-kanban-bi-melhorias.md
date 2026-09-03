# Melhorias de UI (Kanban · BI de Reconversão · Esteira) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar o kanban da esteira, o BI de Reconversão e a aba Esteira do lead intuitivos no design Minimal (hierarquia clara, progresso visível, comparação de períodos), sem mudar schema nem APIs.

**Architecture:** Primitivas novas (`Chip`, `StatCard`, `chartTheme`) concentram o visual; hooks passam a devolver dados já agregados por funções puras testáveis (`summarizeQueue`, `aggregateReconversao`); componentes existentes (`StageColumn`, `KanbanBoard`, `NegociosToolbar`, `BIProReconversaoTab`, `NegocioEsteira`) são refatorados por partes, cada tarefa deixando a tela funcional.

**Tech Stack:** React 18 + TypeScript, Tailwind + shadcn/ui, TanStack Query v5, recharts 2, framer-motion 12, @hello-pangea/dnd, date-fns 3, Vitest (novo, só para funções puras).

**Spec:** `docs/superpowers/specs/2026-09-03-ui-kanban-bi-melhorias.md`

## Global Constraints

- Raio: `rounded-xl` (12 px) em cards e tooltips; chips `rounded-full`. Nunca `rounded-[4px]`/`borderRadius: 4`.
- Tipografia: textos de UI `text-[12px]`–`text-[13px]`; rótulos `text-[11px] uppercase tracking-wide text-muted-foreground`; números grandes `font-semibold tabular-nums`. Nunca fonte serifada.
- Cores só por token (`bg-card`, `border-border`, `text-muted-foreground`, `text-primary`, `--chart-*`); cores literais apenas nas tonalidades semânticas já usadas (emerald/amber/red/sky/violet em 400–500).
- Idioma da UI: português do Brasil, sem emojis em rótulos (emojis permitidos só em textos de e-mail).
- Verificação de tipos: o repo **não** passa `tsc` no baseline. Regra: `npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep -E "<arquivos tocados>"` deve retornar **apenas** erros que já existiam antes (checar com `git stash` → rodar → `git stash pop`). `npx eslint <arquivo>` não pode ter erros novos. `npm run build` deve passar.
- Nenhuma query por card: hooks recebem `leadIds[]` e fazem uma chamada com `.in(...)`.
- Commits pequenos, mensagem em português, trailer `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. Antes de `git push`: `git pull -q --rebase origin main`.
- Sempre `cd /Volumes/nvme/minimal/Minimal-Cases-RevOS` antes de comandos (o cwd não persiste entre chamadas).

---

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| Create `vitest.config.ts`, `src/test/setup.ts` | Runner de testes para funções puras |
| Create `src/components/ui/chip.tsx` | Primitiva Chip (tons semânticos) |
| Create `src/components/ui/stat-card.tsx` | Primitiva StatCard (hero/default/compact, delta) |
| Create `src/lib/chartTheme.ts` · Modify `src/index.css` | Tema recharts + tokens `--chart-1..5` |
| Create `src/lib/esteira/queueSummary.ts` (+ `.test.ts`) | Agregação pura da fila por lead |
| Modify `src/hooks/useEsteiraLead.ts` | `useEsteiraCardData(leadIds)` |
| Modify `src/components/negocios/StageColumn.tsx` | Card redesenhado, coluna recolhível, a11y |
| Create `src/components/negocios/PipelineFunnelStrip.tsx` · Modify `KanbanBoard.tsx` | Funil em uma linha |
| Create `src/components/negocios/ActiveFilterChips.tsx`, `MoreFiltersPopover.tsx` · Modify `NegociosToolbar.tsx` | Toolbar enxuta |
| Create `src/lib/bi/reconversao.ts` (+ `.test.ts`) · Modify `src/hooks/useReconversaoBI.ts` | Agregação pura + período anterior + funil |
| Create `src/components/dashboard/reconversao/{KpiHero,FunnelCard,AttributionCard,DailyChart,ReconversionsTable,InsightsStrip}.tsx` · Modify `BIProReconversaoTab.tsx` | BI decomposto |
| Modify `src/pages/Dashboard.tsx`, `src/components/dashboard/DashboardFilters.tsx` | Preset `30d` |
| Modify `src/components/negocios/NegocioEsteira.tsx`, `src/hooks/useEsteiraLead.ts` | Cabeçalho com ações, timeline por dia, carrinho com imagem/variação |

---

### Task 0: Vitest para funções puras

**Files:**
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Create: `src/components/dashboard/bipro-shared.test.ts`
- Modify: `package.json` (scripts + devDependencies)

**Interfaces:**
- Produces: script `npm test` (vitest run), alias `@/` resolvido nos testes.

- [ ] **Step 1: Instalar**

```bash
cd /Volumes/nvme/minimal/Minimal-Cases-RevOS
npm i -D vitest@^2 @vitest/coverage-v8@^2 jsdom@^25
```

- [ ] **Step 2: Config**

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['src/test/setup.ts'],
    globals: true,
  },
});
```

```ts
// src/test/setup.ts
// Ambiente mínimo: os testes cobrem funções puras (agregações/formatadores). Sem React Testing Library nesta rodada.
export {};
```

Em `package.json`, adicione em `scripts`: `"test": "vitest run"` e `"test:watch": "vitest"`.

- [ ] **Step 3: Primeiro teste (falha antes de existir o runner)**

```ts
// src/components/dashboard/bipro-shared.test.ts
import { describe, expect, it } from 'vitest';
import { fmtBRL, fmtDays } from './bipro-shared';

describe('bipro-shared formatters', () => {
  it('formata BRL sem centavos', () => {
    expect(fmtBRL(1234.5).replace(/ /g, ' ')).toBe('R$ 1.235');
  });
  it('fmtDays trata null', () => {
    expect(fmtDays(null)).toBe('—');
    expect(fmtDays(2.4)).toBe('2d');
  });
});
```

- [ ] **Step 4: Rodar**

Run: `npm test`
Expected: 2 passed. (Se `fmtBRL` arredondar diferente, ajuste a expectativa ao comportamento atual — o teste documenta, não muda a função.)

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts src/test/setup.ts src/components/dashboard/bipro-shared.test.ts package.json package-lock.json
git commit -m "test: vitest para funções puras (formatadores do BI)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 1: Primitiva `Chip` + tema de gráfico + tokens `--chart-*`

**Files:**
- Create: `src/components/ui/chip.tsx`
- Create: `src/lib/chartTheme.ts`
- Modify: `src/index.css` (blocos `:root` e `.dark`)

**Interfaces:**
- Produces: `Chip({ tone, size, icon, title, className, children })`; `chartTheme = { tooltipStyle, tooltipLabelStyle, axisTick, gridStroke, colors: { primary, muted, chart: string[] } }`.

- [ ] **Step 1: Tokens**

Em `src/index.css`, dentro de `:root` (após `--info-foreground`) adicione:

```css
    /* Paleta de gráficos (recharts) — coerente com ink/bone */
    --chart-1: 0 0% 7%;        /* ink */
    --chart-2: 40 4% 45%;      /* #77746d */
    --chart-3: 142 76% 36%;    /* success */
    --chart-4: 48 96% 53%;     /* warning */
    --chart-5: 219 79% 56%;    /* info */
```

E no bloco `.dark` (mesma posição):

```css
    --chart-1: 40 12% 93%;     /* bone */
    --chart-2: 40 4% 55%;
    --chart-3: 142 60% 45%;
    --chart-4: 48 90% 58%;
    --chart-5: 219 79% 62%;
```

- [ ] **Step 2: Chip**

```tsx
// src/components/ui/chip.tsx
import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type ChipTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'violet';
export type ChipSize = 'sm' | 'md';

const TONE: Record<ChipTone, string> = {
  neutral: 'text-muted-foreground bg-muted border-border',
  info:    'text-sky-500 bg-sky-500/10 border-sky-500/25',
  success: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/25',
  warning: 'text-amber-500 bg-amber-500/10 border-amber-500/25',
  danger:  'text-red-500 bg-red-500/10 border-red-500/25',
  violet:  'text-violet-400 bg-violet-400/10 border-violet-400/25',
};
const SIZE: Record<ChipSize, string> = {
  sm: 'text-[10px] px-1.5 py-0.5 gap-0.5 [&>svg]:h-2.5 [&>svg]:w-2.5',
  md: 'text-[11px] px-2 py-0.5 gap-1 [&>svg]:h-3 [&>svg]:w-3',
};

export interface ChipProps {
  tone?: ChipTone;
  size?: ChipSize;
  icon?: ElementType;
  title?: string;
  className?: string;
  children: ReactNode;
}

/** Chip de estado/metadado. Cor = tom semântico; padrão neutro. */
export function Chip({ tone = 'neutral', size = 'sm', icon: Icon, title, className, children }: ChipProps) {
  return (
    <span
      title={title}
      className={cn('inline-flex items-center rounded-full border font-medium leading-none whitespace-nowrap', TONE[tone], SIZE[size], className)}
    >
      {Icon ? <Icon strokeWidth={1.5} aria-hidden /> : null}
      {children}
    </span>
  );
}
```

- [ ] **Step 3: chartTheme**

```ts
// src/lib/chartTheme.ts
/** Tema único dos gráficos recharts — raio 12, tokens do design Minimal. */
export const chartTheme = {
  tooltipStyle: {
    background: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 12,
    fontSize: 12,
    padding: '8px 12px',
    boxShadow: 'none',
  } as const,
  tooltipLabelStyle: { color: 'hsl(var(--muted-foreground))', fontSize: 11, marginBottom: 4 } as const,
  axisTick: { fontSize: 11, fill: 'hsl(var(--muted-foreground))' } as const,
  gridStroke: 'hsl(var(--border))',
  colors: {
    primary: 'hsl(var(--primary))',
    muted: 'hsl(var(--muted-foreground))',
    chart: [1, 2, 3, 4, 5].map((i) => `hsl(var(--chart-${i}))`),
  },
};
```

- [ ] **Step 4: Verificar**

Run: `npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep -E "chip.tsx|chartTheme.ts"; echo TSC-OK; npx eslint src/components/ui/chip.tsx src/lib/chartTheme.ts`
Expected: sem saída do grep; eslint sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/chip.tsx src/lib/chartTheme.ts src/index.css
git commit -m "feat(ds): primitiva Chip, tema de gráfico e tokens --chart-*

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Primitiva `StatCard`

**Files:**
- Create: `src/components/ui/stat-card.tsx`

**Interfaces:**
- Produces: `StatCard({ size?: 'hero'|'default'|'compact', label, value, sub?, delta?: { value: number|null; label?: string; invert?: boolean }, icon?, children?, className? })`. `delta.value` é fração (0.12 = +12%); `invert=true` quando menor é melhor (ex.: tempo).

- [ ] **Step 1: Componente**

```tsx
// src/components/ui/stat-card.tsx
import type { ElementType, ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StatDelta { value: number | null; label?: string; invert?: boolean }
export interface StatCardProps {
  size?: 'hero' | 'default' | 'compact';
  label: string;
  value: string;
  sub?: ReactNode;
  delta?: StatDelta;
  icon?: ElementType;
  children?: ReactNode; // slot (sparkline, mini barra)
  className?: string;
}

function DeltaBadge({ delta }: { delta: StatDelta }) {
  if (delta.value === null || !Number.isFinite(delta.value)) {
    return <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Minus className="h-3 w-3" strokeWidth={1.5} />sem base</span>;
  }
  const up = delta.value > 0.005;
  const down = delta.value < -0.005;
  const good = delta.invert ? down : up;
  const bad = delta.invert ? up : down;
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  const pct = `${delta.value > 0 ? '+' : ''}${(delta.value * 100).toFixed(0)}%`;
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px] font-medium tabular-nums',
      good ? 'text-emerald-500' : bad ? 'text-red-500' : 'text-muted-foreground')}>
      <Icon className="h-3 w-3" strokeWidth={1.75} />{pct}
      {delta.label ? <span className="font-normal text-muted-foreground">{delta.label}</span> : null}
    </span>
  );
}

export function StatCard({ size = 'default', label, value, sub, delta, icon: Icon, children, className }: StatCardProps) {
  const valueCls = size === 'hero' ? 'text-[40px] leading-none' : size === 'compact' ? 'text-[20px] leading-tight' : 'text-[28px] leading-none';
  return (
    <div className={cn('rounded-xl border border-border bg-card flex flex-col', size === 'compact' ? 'p-4 gap-1.5' : 'p-5 gap-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        {Icon ? <Icon className="h-4 w-4 text-muted-foreground/60" strokeWidth={1.5} aria-hidden /> : null}
      </div>
      <div className="flex items-end justify-between gap-3">
        <span className={cn('font-semibold tabular-nums text-foreground', valueCls)}>{value}</span>
        {delta ? <DeltaBadge delta={delta} /> : null}
      </div>
      {sub ? <div className="text-[12px] text-muted-foreground leading-snug">{sub}</div> : null}
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Verificar**

Run: `npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep "stat-card"; echo TSC-OK; npx eslint src/components/ui/stat-card.tsx`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/stat-card.tsx
git commit -m "feat(ds): StatCard (hero/default/compact) com delta vs. período anterior

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Agregação da fila por lead + `useEsteiraCardData`

**Files:**
- Create: `src/lib/esteira/queueSummary.ts`
- Create: `src/lib/esteira/queueSummary.test.ts`
- Modify: `src/hooks/useEsteiraLead.ts` (adicionar hook; manter `useTouchCountsByLead` para compatibilidade)

**Interfaces:**
- Produces:
```ts
export interface QueueRow { lead_id: string; channel: string; status: string; scheduled_for: string | null; subject?: string | null }
export interface LeadQueueSummary {
  sent: { email: number; whatsapp: number; sms: number; total: number };
  pending: number; failed: number; cancelled: number;
  total: number;                       // sent + pending + failed (cancelados não contam)
  nextAt: string | null;               // menor scheduled_for pendente
  nextChannel: 'email' | 'whatsapp' | 'sms' | null;
  nextLabel: string | null;            // subject da regra (ex.: "E2 · Celular voando na praia")
}
export function summarizeQueue(rows: QueueRow[]): Record<string, LeadQueueSummary>
export function channelOf(raw: string): 'email' | 'whatsapp' | 'sms'
```
- Hook: `useEsteiraCardData(leadIds: string[])` → `useQuery<Record<string, LeadQueueSummary>>`.

- [ ] **Step 1: Teste (falha)**

```ts
// src/lib/esteira/queueSummary.test.ts
import { describe, expect, it } from 'vitest';
import { summarizeQueue } from './queueSummary';

const rows = [
  { lead_id: 'a', channel: 'email', status: 'sent', scheduled_for: '2026-09-01T10:00:00Z', subject: 'E1' },
  { lead_id: 'a', channel: 'sms', status: 'queued', scheduled_for: '2026-09-01T12:00:00Z', subject: 'SMS-01' },
  { lead_id: 'a', channel: 'email', status: 'pending', scheduled_for: '2026-09-03T10:00:00Z', subject: 'E3 · Eu ia te mandar' },
  { lead_id: 'a', channel: 'email', status: 'pending', scheduled_for: '2026-09-02T10:00:00Z', subject: 'E2 · Celular voando' },
  { lead_id: 'a', channel: 'whatsapp_template', status: 'cancelled', scheduled_for: null, subject: 'WA-01' },
  { lead_id: 'b', channel: 'email', status: 'failed', scheduled_for: '2026-09-01T10:00:00Z', subject: 'E1' },
];

describe('summarizeQueue', () => {
  it('conta enviados por canal (sent e queued contam como enviados)', () => {
    const s = summarizeQueue(rows)['a'];
    expect(s.sent).toEqual({ email: 1, whatsapp: 0, sms: 1, total: 2 });
  });
  it('acha o próximo pendente pelo menor scheduled_for', () => {
    const s = summarizeQueue(rows)['a'];
    expect(s.pending).toBe(2);
    expect(s.nextAt).toBe('2026-09-02T10:00:00Z');
    expect(s.nextChannel).toBe('email');
    expect(s.nextLabel).toBe('E2 · Celular voando');
  });
  it('cancelados não entram no total; falhos entram', () => {
    expect(summarizeQueue(rows)['a'].total).toBe(4);
    expect(summarizeQueue(rows)['b']).toMatchObject({ failed: 1, total: 1, nextAt: null });
  });
});
```

- [ ] **Step 2: Rodar** — `npm test` → FAIL (módulo inexistente).

- [ ] **Step 3: Implementar**

```ts
// src/lib/esteira/queueSummary.ts
export interface QueueRow { lead_id: string; channel: string; status: string; scheduled_for: string | null; subject?: string | null }
export type Channel = 'email' | 'whatsapp' | 'sms';
export interface LeadQueueSummary {
  sent: Record<Channel, number> & { total: number };
  pending: number; failed: number; cancelled: number; total: number;
  nextAt: string | null; nextChannel: Channel | null; nextLabel: string | null;
}

export function channelOf(raw: string): Channel {
  if (raw === 'email') return 'email';
  if (raw === 'sms') return 'sms';
  return 'whatsapp'; // whatsapp_template, whatsapp_texto, etc.
}

const SENT = new Set(['sent', 'queued', 'delivered', 'read']);

function empty(): LeadQueueSummary {
  return { sent: { email: 0, whatsapp: 0, sms: 0, total: 0 }, pending: 0, failed: 0, cancelled: 0, total: 0, nextAt: null, nextChannel: null, nextLabel: null };
}

export function summarizeQueue(rows: QueueRow[]): Record<string, LeadQueueSummary> {
  const out: Record<string, LeadQueueSummary> = {};
  for (const r of rows) {
    const s = (out[r.lead_id] ??= empty());
    const ch = channelOf(r.channel);
    if (SENT.has(r.status)) { s.sent[ch]++; s.sent.total++; s.total++; }
    else if (r.status === 'pending' || r.status === 'processing') {
      s.pending++; s.total++;
      if (r.scheduled_for && (!s.nextAt || r.scheduled_for < s.nextAt)) {
        s.nextAt = r.scheduled_for; s.nextChannel = ch; s.nextLabel = r.subject ?? null;
      }
    }
    else if (r.status === 'failed') { s.failed++; s.total++; }
    else if (r.status === 'cancelled') { s.cancelled++; }
  }
  return out;
}
```

- [ ] **Step 4: Rodar** — `npm test` → 3 passed.

- [ ] **Step 5: Hook** — em `src/hooks/useEsteiraLead.ts`, logo após `useTouchCountsByLead`, adicione:

```ts
import { summarizeQueue, type LeadQueueSummary, type QueueRow } from '@/lib/esteira/queueSummary';

/** Dados da esteira por card do kanban: enviados por canal, pendentes, próximo toque. Uma query por lista. */
export function useEsteiraCardData(leadIds: string[]) {
  const key = [...leadIds].sort().join(',');
  return useQuery({
    queryKey: ['esteira', 'card-data', key],
    enabled: leadIds.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<Record<string, LeadQueueSummary>> => {
      const { data, error } = await db
        .from('followup_queue')
        .select('lead_id, channel, status, scheduled_for, subject')
        .in('lead_id', leadIds)
        .in('status', ['sent', 'queued', 'delivered', 'read', 'pending', 'processing', 'failed', 'cancelled']);
      if (error) throw error;
      return summarizeQueue((data ?? []) as QueueRow[]);
    },
  });
}
```

- [ ] **Step 6: Verificar e commitar**

Run: `npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep -E "useEsteiraLead|queueSummary"; echo TSC-OK`

```bash
git add src/lib/esteira src/hooks/useEsteiraLead.ts
git commit -m "feat(esteira): agregação da fila por lead (summarizeQueue) + useEsteiraCardData

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Card do kanban redesenhado

**Files:**
- Modify: `src/components/negocios/StageColumn.tsx` (bloco do card, linhas ~160–300; imports; substituir `useTouchCountsByLead` por `useEsteiraCardData`)

**Interfaces:**
- Consumes: `Chip` (Task 1), `useEsteiraCardData` (Task 3), `NegocioOptimized` (existente: `title`, `value`, `created_at`, `pessoa.name`, `pessoa.unread_count`, `pessoa.first_unread_at`, `tags[].tag.name`).
- Produces: helper local `productFromTitle(title?: string): string | null` (texto antes de " — ").

- [ ] **Step 1: Helpers locais** (topo do arquivo, após imports)

```ts
import { Chip } from '@/components/ui/chip';
import { useEsteiraCardData } from '@/hooks/useEsteiraLead';
import { formatDistanceToNowStrict, isPast } from 'date-fns';

/** "Case Couro — Gabriella" → "Case Couro". Títulos sem separador voltam inteiros. */
export function productFromTitle(title?: string | null): string | null {
  if (!title) return null;
  const [produto] = title.split(' — ');
  return produto.trim() || null;
}

const CHANNEL_LABEL: Record<string, string> = { email: 'E-mail', whatsapp: 'WhatsApp', sms: 'SMS' };

function nextTouchText(nextAt: string | null, nextChannel: string | null): string | null {
  if (!nextAt || !nextChannel) return null;
  const d = new Date(nextAt);
  const when = isPast(d) ? 'agora' : `em ${formatDistanceToNowStrict(d, { locale: ptBR })}`;
  return `${CHANNEL_LABEL[nextChannel] ?? nextChannel} ${when}`;
}
```

Troque `const { data: touchCounts = {} } = useTouchCountsByLead(leadIds);` por `const { data: cardData = {} } = useEsteiraCardData(leadIds);` e remova o import de `useTouchCountsByLead` se não for mais usado.

- [ ] **Step 2: Substituir o JSX do card** — dentro de `{({ snapshot }) => ( <div onClick=... > ... </div> )}` troque TODO o conteúdo interno do card (do comentário `{/* Name + value */}` até o fim de `{/* Chips row */}`) por:

```tsx
{(() => {
  const s = cardData[negocio.id];
  const produto = productFromTitle(negocio.title);
  const d = daysSince(negocio.created_at);
  const next = s ? nextTouchText(s.nextAt, s.nextChannel) : null;
  const pct = s && s.total > 0 ? Math.round((s.sent.total / s.total) * 100) : 0;
  const tags = (negocio.tags ?? []).map((t) => t.tag?.name).filter(Boolean) as string[];
  const unread = negocio.pessoa?.unread_count ?? 0;
  return (
    <>
      {/* 1 · quem + quanto */}
      <div className="flex items-start justify-between gap-2">
        <p className="flex-1 min-w-0 text-[13px] font-medium text-foreground truncate leading-tight">
          {negocio.pessoa?.name || 'Sem nome'}
        </p>
        <div className="flex items-center gap-1 flex-shrink-0">
          <p className="text-[13px] font-semibold text-foreground tabular-nums whitespace-nowrap">{formatCurrency(negocio.value || 0)}</p>
          {negocio.status === 'in_progress' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground/40 hover:text-foreground -mr-1" onClick={(e) => e.stopPropagation()} aria-label="Mais ações">
                  <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={1.5} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setShowLostModal(negocio.id); }} className="text-[13px] gap-2 cursor-pointer text-destructive focus:text-destructive">
                  <XCircle className="h-3.5 w-3.5" strokeWidth={1.5} />Marcar como Perdido
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* 2 · o quê */}
      {produto && <p className="text-[11.5px] text-muted-foreground truncate leading-tight">{produto}</p>}

      {/* 3 · progresso da esteira */}
      {s && s.total > 0 ? (
        <div className="space-y-1 pt-1">
          <div className="flex items-center justify-between text-[10.5px] text-muted-foreground">
            <span className="tabular-nums">{s.sent.total} de {s.total} toques</span>
            <span className="truncate ml-2">{next ? `próximo: ${next}` : s.pending === 0 ? 'esteira concluída' : ''}</span>
          </div>
          <div className="h-1 w-full rounded-full bg-muted overflow-hidden" aria-hidden>
            <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : (
        <p className="text-[10.5px] text-muted-foreground/60 pt-1">sem toques agendados</p>
      )}

      {/* 4 · estado */}
      <div className="flex items-center gap-1 flex-wrap pt-1.5 border-t border-border/60">
        {unread > 0 && <Chip tone="danger" icon={MessageCircle} title="Mensagens não lidas">{unread}</Chip>}
        {s && s.failed > 0 && <Chip tone="warning" title="Toques com falha">{s.failed} falhou</Chip>}
        {tags.slice(0, 2).map((t) => <Chip key={t}>{t}</Chip>)}
        {tags.length > 2 && <Chip title={tags.slice(2).join(', ')}>+{tags.length - 2}</Chip>}
        {d !== null && (
          <Chip
            className="ml-auto"
            icon={Clock}
            tone={d >= 7 ? 'danger' : d >= 3 ? 'warning' : 'neutral'}
            title={`No funil desde ${format(new Date(negocio.created_at), 'dd/MM/yy', { locale: ptBR })}`}
          >
            {d === 0 ? 'hoje' : `${d}d`}
          </Chip>
        )}
      </div>
    </>
  );
})()}
```

- [ ] **Step 3: A11y no container do card** — no `<div onClick={() => navigate(...)}` do card, adicione:

```tsx
role="button"
tabIndex={0}
aria-label={`${negocio.pessoa?.name || 'Lead'}, ${formatCurrency(negocio.value || 0)}${cardData[negocio.id] ? `, ${cardData[negocio.id].sent.total} de ${cardData[negocio.id].total} toques` : ''}`}
onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/crm/kanban/${negocio.id}`); } }}
```
e na classe, troque `"hover:bg-white/[0.035] hover:border-white/[0.10]"` por `"hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"`.

- [ ] **Step 4: Limpar imports** — remova imports que ficaram sem uso (`Building2`, `Megaphone`, `Mail`, `Smartphone`, `Star`, `CursoBadges`, `TagBadges`, `UnreadBadge`, `getScoreColor`, `messageCounts` e o hook que o alimenta) — apenas os que o eslint apontar como não usados; não remova nada ainda referenciado.

- [ ] **Step 5: Verificar**

Run: `npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep "StageColumn"; echo TSC-OK; npx eslint src/components/negocios/StageColumn.tsx; npm run build 2>&1 | tail -1`
Expected: sem erros novos; build `✓ built`.
Visual (dev server `npm run dev`, `/crm/kanban`): card mostra nome, valor, produto, barra "n de N toques · próximo: …", chips ≤ 4; Tab foca os cards; Enter abre.

- [ ] **Step 6: Commit**

```bash
git add src/components/negocios/StageColumn.tsx
git commit -m "feat(kanban): card com hierarquia (quem · o quê · quanto · progresso · estado) e a11y

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Coluna — cabeçalho com %, recolher, drop-target, skeleton

**Files:**
- Modify: `src/components/negocios/StageColumn.tsx` (props, cabeçalho ~126–140, área droppable ~144–158)
- Modify: `src/components/negocios/KanbanBoard.tsx` (passar `totalLeads` e `pipelineId`)

**Interfaces:**
- `StageColumnProps` ganha `totalLeads: number` (soma de negócios exibidos no pipeline) e `pipelineId: string`.
- Estado de recolhimento: `localStorage['kanban:collapsed:<pipelineId>']` = JSON array de stage ids.

- [ ] **Step 1: Props e estado**

```ts
interface StageColumnProps {
  stage: Stage;
  negocios: NegocioOptimized[];
  totalValue: number;
  isLoading: boolean;
  totalLeads: number;
  pipelineId: string;
}

function useCollapsed(pipelineId: string, stageId: string): [boolean, () => void] {
  const key = `kanban:collapsed:${pipelineId}`;
  const read = (): string[] => { try { return JSON.parse(localStorage.getItem(key) ?? '[]'); } catch { return []; } };
  const [collapsed, setCollapsed] = useState<boolean>(() => read().includes(stageId));
  const toggle = () => {
    const cur = new Set(read());
    if (cur.has(stageId)) cur.delete(stageId); else cur.add(stageId);
    try { localStorage.setItem(key, JSON.stringify([...cur])); } catch { /* storage indisponível */ }
    setCollapsed(cur.has(stageId));
  };
  return [collapsed, toggle];
}
```

- [ ] **Step 2: Cabeçalho e coluna recolhida** — substitua o `<div className="w-72 flex-shrink-0 ...">` inicial e o cabeçalho por:

```tsx
const [collapsed, toggleCollapsed] = useCollapsed(pipelineId, stage.id);
const share = totalLeads > 0 ? Math.round((negocios.length / totalLeads) * 100) : 0;

if (collapsed) {
  return (
    <button
      type="button"
      onClick={toggleCollapsed}
      className="w-10 flex-shrink-0 border border-border rounded-xl bg-card flex flex-col items-center py-3 gap-2 hover:border-foreground/20 transition-colors"
      aria-label={`Expandir etapa ${stage.nome} (${negocios.length})`}
      title="Expandir"
    >
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.cor || 'hsl(var(--muted-foreground))' }} />
      <span className="text-[11px] font-semibold tabular-nums text-foreground">{negocios.length}</span>
      <span className="text-[11px] text-muted-foreground [writing-mode:vertical-rl] rotate-180 truncate max-h-[200px]">{stage.nome}</span>
    </button>
  );
}

return (
  <div className="w-72 flex-shrink-0 border border-border rounded-xl bg-card flex flex-col h-full overflow-hidden" role="region" aria-label={`Etapa ${stage.nome} — ${negocios.length} negócios`}>
    <div className="flex items-center justify-between px-3 py-2.5 border-b border-border flex-shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: stage.cor || 'hsl(var(--muted-foreground))' }} />
        <span className="text-[13px] font-medium text-foreground truncate">{stage.nome}</span>
        <span className="text-[11px] text-muted-foreground tabular-nums flex-shrink-0">{negocios.length}</span>
        {totalLeads > 0 && <span className="text-[10px] text-muted-foreground/60 tabular-nums flex-shrink-0">· {share}%</span>}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <span className="text-[11px] font-medium text-muted-foreground tabular-nums">{formatCurrency(totalValue)}</span>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground/50 hover:text-foreground" onClick={toggleCollapsed} aria-label={`Recolher etapa ${stage.nome}`} title="Recolher">
          <ChevronsLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
        </Button>
      </div>
    </div>
```
(importe `ChevronsLeft` de `lucide-react`; o restante do componente segue igual.)

- [ ] **Step 3: Drop-target e skeleton** — na área droppable troque `snapshot.isDraggingOver && "bg-accent/5"` por `snapshot.isDraggingOver && "bg-primary/[0.03] ring-1 ring-inset ring-primary/30 rounded-lg"`, e o skeleton por:

```tsx
{[...Array(3)].map((_, i) => (
  <div key={i} className="rounded-xl border border-border bg-background p-3 space-y-2">
    <div className="flex justify-between"><Skeleton className="h-3.5 w-28 rounded-full" /><Skeleton className="h-3.5 w-14 rounded-full" /></div>
    <Skeleton className="h-3 w-40 rounded-full" />
    <Skeleton className="h-1 w-full rounded-full" />
    <div className="flex gap-1"><Skeleton className="h-4 w-10 rounded-full" /><Skeleton className="h-4 w-8 rounded-full" /></div>
  </div>
))}
```

- [ ] **Step 4: KanbanBoard** — onde renderiza `<StageColumn ... />`, calcule antes `const totalLeads = displayStages.reduce((acc, s) => acc + (negociosByStage[s.id]?.length ?? 0), 0);` (use o nome real da estrutura que o board já monta por stage) e passe `totalLeads={totalLeads} pipelineId={pipelineId || ''}`.

- [ ] **Step 5: Verificar e commitar**

Run: `npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep -E "StageColumn|KanbanBoard"; echo TSC-OK; npx eslint src/components/negocios/StageColumn.tsx src/components/negocios/KanbanBoard.tsx; npm run build 2>&1 | tail -1`
Visual: recolher uma coluna, recarregar — continua recolhida; % no cabeçalho; arrastar um card mostra o anel na coluna alvo.

```bash
git add src/components/negocios/StageColumn.tsx src/components/negocios/KanbanBoard.tsx
git commit -m "feat(kanban): coluna com % do funil, recolher persistente, drop-target e skeleton reais

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: `PipelineFunnelStrip` (funil em uma linha)

**Files:**
- Create: `src/components/negocios/PipelineFunnelStrip.tsx`
- Modify: `src/components/negocios/KanbanBoard.tsx` (renderizar acima das colunas; receber `stageFilter`/`onStageFilterChange` — se o board não recebe hoje, adicionar às props e repassar de `src/pages/Negocios.tsx`)

**Interfaces:**
- `PipelineFunnelStrip({ stages: Array<{ id: string; nome: string; cor?: string | null; count: number }>, activeStageId: string | null, onSelect: (stageId: string | null) => void })`.

- [ ] **Step 1: Componente**

```tsx
// src/components/negocios/PipelineFunnelStrip.tsx
import { cn } from '@/lib/utils';

export interface FunnelStage { id: string; nome: string; cor?: string | null; count: number }
interface Props { stages: FunnelStage[]; activeStageId: string | null; onSelect: (stageId: string | null) => void }

/** Distribuição dos leads por etapa em uma barra segmentada; clique filtra a etapa. */
export default function PipelineFunnelStrip({ stages, activeStageId, onSelect }: Props) {
  const total = stages.reduce((a, s) => a + s.count, 0);
  if (total === 0) return null;
  return (
    <div className="px-4 pt-3 pb-1 space-y-1.5">
      <div className="flex h-2 w-full rounded-full overflow-hidden bg-muted" role="img" aria-label={`Distribuição: ${stages.map((s) => `${s.nome} ${s.count}`).join(', ')}`}>
        {stages.filter((s) => s.count > 0).map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(activeStageId === s.id ? null : s.id)}
            title={`${s.nome} · ${s.count} (${Math.round((s.count / total) * 100)}%)`}
            className={cn('h-full transition-opacity hover:opacity-100', activeStageId && activeStageId !== s.id ? 'opacity-30' : 'opacity-90')}
            style={{ width: `${(s.count / total) * 100}%`, backgroundColor: s.cor || 'hsl(var(--muted-foreground))' }}
            aria-label={`Filtrar ${s.nome}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {stages.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(activeStageId === s.id ? null : s.id)}
            className={cn('inline-flex items-center gap-1.5 text-[11px] rounded-full px-1 -mx-1 transition-colors',
              activeStageId === s.id ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground')}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.cor || 'hsl(var(--muted-foreground))' }} />
            {s.nome} <span className="tabular-nums">{s.count}</span>
          </button>
        ))}
        <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">{total} leads</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Montar no board** — em `KanbanBoard.tsx`, acima do `<div className="flex gap-3 min-w-max h-full" ...>`, renderize:

```tsx
<PipelineFunnelStrip
  stages={stages.map((s) => ({ id: s.id, nome: s.nome, cor: s.cor, count: negociosByStage[s.id]?.length ?? 0 }))}
  activeStageId={stageFilter ?? null}
  onSelect={(id) => onStageFilterChange?.(id)}
/>
```
Use `stages` (todos os stages do pipeline, não só `displayStages`) para a faixa mostrar o funil inteiro mesmo com um stage filtrado. Se `onStageFilterChange` não existir nas props do board, adicione `stageFilter?: string | null; onStageFilterChange?: (id: string | null) => void;` e passe de `Negocios.tsx` (`stageFilter`, `setStageFilter`).

- [ ] **Step 3: Verificar e commitar**

Run: `npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep -E "PipelineFunnelStrip|KanbanBoard|Negocios.tsx"; echo TSC-OK; npm run build 2>&1 | tail -1`
Visual: faixa acima das colunas; clicar num segmento filtra a etapa; clicar de novo limpa.

```bash
git add src/components/negocios/PipelineFunnelStrip.tsx src/components/negocios/KanbanBoard.tsx src/pages/Negocios.tsx
git commit -m "feat(kanban): funil em uma linha acima das colunas (clique filtra a etapa)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Toolbar enxuta — "Filtros (n)" + chips de filtros ativos

**Files:**
- Create: `src/components/negocios/ActiveFilterChips.tsx`
- Create: `src/components/negocios/MoreFiltersPopover.tsx`
- Modify: `src/components/negocios/NegociosToolbar.tsx` (linha primária ~239+; mover selects secundários para o popover)

**Interfaces:**
- `ActiveFilterChips({ items: Array<{ key: string; label: string; onClear: () => void }>, onClearAll: () => void })`.
- `MoreFiltersPopover({ count: number; children: ReactNode })` — wrapper com `Popover` (shadcn) e botão gatilho "Filtros" com badge.
- A API pública (props) de `NegociosToolbar` **não muda**.

- [ ] **Step 1: ActiveFilterChips**

```tsx
// src/components/negocios/ActiveFilterChips.tsx
import { X } from 'lucide-react';
import { Chip } from '@/components/ui/chip';

export interface ActiveFilter { key: string; label: string; onClear: () => void }

export default function ActiveFilterChips({ items, onClearAll }: { items: ActiveFilter[]; onClearAll: () => void }) {
  if (items.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5 flex-wrap px-4 pb-2">
      {items.map((f) => (
        <button key={f.key} type="button" onClick={f.onClear} aria-label={`Remover filtro ${f.label}`} className="group">
          <Chip size="md" className="group-hover:border-foreground/30">
            {f.label}<X className="h-3 w-3 opacity-60 group-hover:opacity-100" strokeWidth={1.5} />
          </Chip>
        </button>
      ))}
      <button type="button" onClick={onClearAll} className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-4 ml-1">Limpar tudo</button>
    </div>
  );
}
```

- [ ] **Step 2: MoreFiltersPopover**

```tsx
// src/components/negocios/MoreFiltersPopover.tsx
import type { ReactNode } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export default function MoreFiltersPopover({ count, children }: { count: number; children: ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-[30px] gap-1.5 text-[12px] rounded-lg">
          <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.5} />
          Filtros
          {count > 0 && <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] px-1 tabular-nums">{count}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[560px] p-4 rounded-xl">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Mais filtros</p>
        <div className="grid grid-cols-2 gap-3">{children}</div>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 3: Reorganizar a toolbar** — em `NegociosToolbar.tsx`:
  1. Mantenha na linha primária (`<div className="flex items-center gap-2 px-4 py-2">`): grupo de modo de visualização, `Select` de Pipeline, `Input` de busca, `Select` de Status, `Select` de Data (período), o novo `<MoreFiltersPopover count={secondaryCount}>…</MoreFiltersPopover>`, botão Limpar/Atualizar e "Novo negócio" (mantenha os botões existentes).
  2. Mova para dentro do popover (como filhos, cada um envolto em `<div className="space-y-1"><label className="text-[11px] text-muted-foreground">Rótulo</label> …select… </div>`): Etapa, Equipe, Responsável, Campaign, Source, Medium, Term, Content, Score, Motivo de perda, Produto, Tags, Canais.
  3. Calcule `secondaryCount` = quantidade dessas props com valor diferente de vazio/`'all'`/`null`.
  4. Abaixo da linha primária, renderize `<ActiveFilterChips items={activeItems} onClearAll={onClearFilters} />` onde `activeItems` é construído a partir das props com valor (ex.: `{ key: 'stage', label: 'Etapa: <nome>', onClear: () => onStageFilterChange(null) }`); para selects com ids (etapa, pipeline, responsável) resolva o nome pelas listas já carregadas no componente (`stages`, `pipelines`, `users`) — se o nome não estiver disponível, mostre o valor bruto.

- [ ] **Step 4: Verificar**

Run: `npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep -E "NegociosToolbar|ActiveFilterChips|MoreFiltersPopover"; echo TSC-OK; npx eslint src/components/negocios/NegociosToolbar.tsx src/components/negocios/ActiveFilterChips.tsx src/components/negocios/MoreFiltersPopover.tsx; npm run build 2>&1 | tail -1`
Visual em 1280 px: uma linha, sem scroll horizontal; abrir "Filtros", escolher Tag → badge "1" e chip abaixo; × no chip limpa só aquele filtro.

- [ ] **Step 5: Commit**

```bash
git add src/components/negocios/NegociosToolbar.tsx src/components/negocios/ActiveFilterChips.tsx src/components/negocios/MoreFiltersPopover.tsx
git commit -m "feat(kanban): toolbar enxuta — filtros secundários em popover e chips de filtros ativos

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Agregação pura do BI + período anterior + funil + níveis

**Files:**
- Create: `src/lib/bi/reconversao.ts`
- Create: `src/lib/bi/reconversao.test.ts`
- Modify: `src/hooks/useReconversaoBI.ts` (buscar também período anterior e cliques; delegar cálculo)

**Interfaces:**
- Produces:
```ts
export interface RecRow { order_total: number | null; paid_at: string; attributed: boolean; attribution_level: 'cupom'|'clique'|'janela'|null; people_id: string | null; hours_since_last_touch: number | null; touches_email: number; touches_whatsapp: number; touches_sms: number; coupon_code: string | null }
export interface TouchRow { channel: string; person_id: string | null; fired_at: string | null }
export interface ClickRow { people_id: string | null; first_clicked_at: string | null }
export interface Kpis { reconvertidos: number; organicos: number; receita: number; ticketMedio: number | null; leadsTocados: number; taxa: number | null; horasMedias: number | null; toques: { email: number; whatsapp: number; sms: number; total: number } }
export interface Agregado {
  atual: Kpis; anterior: Kpis;
  deltas: { receita: number | null; reconvertidos: number | null; taxa: number | null; horas: number | null };
  porNivel: Record<'cupom'|'clique'|'janela', number>;
  porNivelReceita: Record<'cupom'|'clique'|'janela'|'organico', number>;
  funil: { tocados: number; clicaram: number; pagaram: number };
  porCanalUltimoToque: Record<'email'|'whatsapp'|'sms', number>;   // canal com mais toques na linha atribuída (proxy do último)
  porDia: Array<{ dia: string; reconversoes: number; receita: number }>;
  topCupons: Array<{ code: string; pedidos: number; receita: number }>;
}
export function kpis(rows: RecRow[], touches: TouchRow[]): Kpis
export function delta(cur: number | null, prev: number | null): number | null   // (cur-prev)/prev; null se prev 0/null
export function aggregateReconversao(input: { rows: RecRow[]; touches: TouchRow[]; clicks: ClickRow[]; prevRows: RecRow[]; prevTouches: TouchRow[] }): Agregado
```
- Hook `useReconversaoBI(dateFrom, dateTo)` passa a devolver `ReconversaoBI & { agregado: Agregado }` (mantendo os campos antigos para não quebrar consumidores).

- [ ] **Step 1: Testes (falham)**

```ts
// src/lib/bi/reconversao.test.ts
import { describe, expect, it } from 'vitest';
import { aggregateReconversao, delta, kpis } from './reconversao';

const r = (over: Partial<Parameters<typeof kpis>[0][number]> = {}) => ({
  order_total: 100, paid_at: '2026-09-02T12:00:00Z', attributed: true, attribution_level: 'cupom' as const,
  people_id: 'p1', hours_since_last_touch: 10, touches_email: 2, touches_whatsapp: 0, touches_sms: 1, coupon_code: 'VOLTA10', ...over,
});
const t = (person_id: string, channel = 'email') => ({ channel, person_id, fired_at: '2026-09-01T10:00:00Z' });

describe('kpis', () => {
  it('separa atribuídos de orgânicos e calcula taxa sobre tocados', () => {
    const k = kpis([r(), r({ attributed: false, attribution_level: null, people_id: 'p9' })], [t('p1'), t('p2'), t('p2', 'sms')]);
    expect(k.reconvertidos).toBe(1); expect(k.organicos).toBe(1);
    expect(k.leadsTocados).toBe(2); expect(k.taxa).toBeCloseTo(0.5);
    expect(k.toques).toEqual({ email: 2, whatsapp: 0, sms: 1, total: 3 });
    expect(k.receita).toBe(100); expect(k.ticketMedio).toBe(100);
  });
});

describe('delta', () => {
  it('fração com sinal; null sem base', () => {
    expect(delta(120, 100)).toBeCloseTo(0.2); expect(delta(80, 100)).toBeCloseTo(-0.2);
    expect(delta(10, 0)).toBeNull(); expect(delta(10, null)).toBeNull();
  });
});

describe('aggregateReconversao', () => {
  it('funil, níveis, receita por nível e top cupons', () => {
    const a = aggregateReconversao({
      rows: [r(), r({ attribution_level: 'clique', coupon_code: null, people_id: 'p2', order_total: 50 }), r({ attributed: false, attribution_level: null, people_id: 'p9', order_total: 30 })],
      touches: [t('p1'), t('p2'), t('p3')],
      clicks: [{ people_id: 'p2', first_clicked_at: '2026-09-01T11:00:00Z' }, { people_id: 'p7', first_clicked_at: null }],
      prevRows: [r({ order_total: 200 })], prevTouches: [t('p1')],
    });
    expect(a.funil).toEqual({ tocados: 3, clicaram: 1, pagaram: 2 });
    expect(a.porNivel).toEqual({ cupom: 1, clique: 1, janela: 0 });
    expect(a.porNivelReceita).toEqual({ cupom: 100, clique: 50, janela: 0, organico: 30 });
    expect(a.topCupons).toEqual([{ code: 'VOLTA10', pedidos: 1, receita: 100 }]);
    expect(a.deltas.receita).toBeCloseTo((150 - 200) / 200);
    expect(a.porCanalUltimoToque.email).toBe(2);
  });
});
```

- [ ] **Step 2: Rodar** — `npm test` → FAIL.

- [ ] **Step 3: Implementar**

```ts
// src/lib/bi/reconversao.ts
export type Nivel = 'cupom' | 'clique' | 'janela';
export interface RecRow { order_total: number | null; paid_at: string; attributed: boolean; attribution_level: Nivel | null; people_id: string | null; hours_since_last_touch: number | null; touches_email: number; touches_whatsapp: number; touches_sms: number; coupon_code: string | null }
export interface TouchRow { channel: string; person_id: string | null; fired_at: string | null }
export interface ClickRow { people_id: string | null; first_clicked_at: string | null }
export interface Kpis { reconvertidos: number; organicos: number; receita: number; ticketMedio: number | null; leadsTocados: number; taxa: number | null; horasMedias: number | null; toques: { email: number; whatsapp: number; sms: number; total: number } }
export interface Agregado {
  atual: Kpis; anterior: Kpis;
  deltas: { receita: number | null; reconvertidos: number | null; taxa: number | null; horas: number | null };
  porNivel: Record<Nivel, number>;
  porNivelReceita: Record<Nivel | 'organico', number>;
  funil: { tocados: number; clicaram: number; pagaram: number };
  porCanalUltimoToque: Record<'email' | 'whatsapp' | 'sms', number>;
  porDia: Array<{ dia: string; reconversoes: number; receita: number }>;
  topCupons: Array<{ code: string; pedidos: number; receita: number }>;
}

const canal = (c: string) => (c === 'email' ? 'email' : c === 'sms' ? 'sms' : 'whatsapp') as 'email' | 'whatsapp' | 'sms';

export function kpis(rows: RecRow[], touches: TouchRow[]): Kpis {
  const attributed = rows.filter((r) => r.attributed);
  const receita = attributed.reduce((a, r) => a + (r.order_total ?? 0), 0);
  const tocados = new Set(touches.map((t) => t.person_id).filter(Boolean)).size;
  const toques = { email: 0, whatsapp: 0, sms: 0, total: 0 };
  for (const t of touches) { toques[canal(t.channel)]++; toques.total++; }
  const horas = attributed.map((r) => r.hours_since_last_touch).filter((h): h is number => h !== null);
  return {
    reconvertidos: attributed.length,
    organicos: rows.length - attributed.length,
    receita,
    ticketMedio: attributed.length ? receita / attributed.length : null,
    leadsTocados: tocados,
    taxa: tocados ? attributed.length / tocados : null,
    horasMedias: horas.length ? horas.reduce((a, b) => a + b, 0) / horas.length : null,
    toques,
  };
}

export function delta(cur: number | null, prev: number | null): number | null {
  if (cur === null || prev === null || !prev) return null;
  return (cur - prev) / prev;
}

export function aggregateReconversao(input: { rows: RecRow[]; touches: TouchRow[]; clicks: ClickRow[]; prevRows: RecRow[]; prevTouches: TouchRow[] }): Agregado {
  const { rows, touches, clicks, prevRows, prevTouches } = input;
  const atual = kpis(rows, touches);
  const anterior = kpis(prevRows, prevTouches);
  const attributed = rows.filter((r) => r.attributed);

  const porNivel: Record<Nivel, number> = { cupom: 0, clique: 0, janela: 0 };
  const porNivelReceita: Record<Nivel | 'organico', number> = { cupom: 0, clique: 0, janela: 0, organico: 0 };
  for (const r of rows) {
    if (r.attributed && r.attribution_level) { porNivel[r.attribution_level]++; porNivelReceita[r.attribution_level] += r.order_total ?? 0; }
    else porNivelReceita.organico += r.order_total ?? 0;
  }

  const clicaram = new Set(clicks.filter((c) => c.first_clicked_at && c.people_id).map((c) => c.people_id)).size;

  const porCanalUltimoToque = { email: 0, whatsapp: 0, sms: 0 };
  for (const r of attributed) {
    const best = ([['email', r.touches_email], ['whatsapp', r.touches_whatsapp], ['sms', r.touches_sms]] as const)
      .sort((a, b) => b[1] - a[1])[0];
    if (best[1] > 0) porCanalUltimoToque[best[0]]++;
  }

  const porDiaMap = new Map<string, { reconversoes: number; receita: number }>();
  for (const r of attributed) {
    const d = r.paid_at.slice(0, 10);
    const cur = porDiaMap.get(d) ?? { reconversoes: 0, receita: 0 };
    cur.reconversoes++; cur.receita += r.order_total ?? 0; porDiaMap.set(d, cur);
  }
  const porDia = [...porDiaMap.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([dia, v]) => ({ dia, ...v }));

  const cupons = new Map<string, { pedidos: number; receita: number }>();
  for (const r of attributed) {
    if (r.attribution_level !== 'cupom' || !r.coupon_code) continue;
    const c = cupons.get(r.coupon_code) ?? { pedidos: 0, receita: 0 };
    c.pedidos++; c.receita += r.order_total ?? 0; cupons.set(r.coupon_code, c);
  }
  const topCupons = [...cupons.entries()].map(([code, v]) => ({ code, ...v })).sort((a, b) => b.receita - a.receita).slice(0, 5);

  return {
    atual, anterior,
    deltas: {
      receita: delta(atual.receita, anterior.receita),
      reconvertidos: delta(atual.reconvertidos, anterior.reconvertidos),
      taxa: delta(atual.taxa, anterior.taxa),
      horas: delta(atual.horasMedias, anterior.horasMedias),
    },
    porNivel, porNivelReceita,
    funil: { tocados: atual.leadsTocados, clicaram, pagaram: atual.reconvertidos },
    porCanalUltimoToque, porDia, topCupons,
  };
}
```

- [ ] **Step 4: Rodar** — `npm test` → todos passam.

- [ ] **Step 5: Hook** — em `useReconversaoBI.ts`, dentro do `queryFn`, após carregar `all` (linhas atuais) e antes do `return`:
  1. Calcule o período anterior: `const spanMs = new Date(to).getTime() - new Date(from).getTime(); const prevFrom = new Date(new Date(from).getTime() - spanMs).toISOString(); const prevTo = from;`
  2. Busque em paralelo (`Promise.all`): `esteira_reconversions` com `paid_at` entre `prevFrom` e `prevTo`; `followup_queue` (`channel, person_id, fired_at`, status `sent`) entre `prevFrom`/`prevTo`; `tracked_links` (`people_id, first_clicked_at`) com `first_clicked_at` entre `from`/`to`.
  3. `const agregado = aggregateReconversao({ rows: all, touches: touchRows, clicks, prevRows, prevTouches });`
  4. No objeto retornado, acrescente `agregado` e amplie a interface: `export interface ReconversaoBI { …campos atuais…; agregado: Agregado }` (importe `Agregado` de `@/lib/bi/reconversao`).
  Mantenha `porDia`, `rows` e os KPIs atuais (podem ser lidos de `agregado.atual`, mas continue expondo para não quebrar).

- [ ] **Step 6: Verificar e commitar**

Run: `npm test; npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep -E "useReconversaoBI|lib/bi"; echo TSC-OK`

```bash
git add src/lib/bi src/hooks/useReconversaoBI.ts
git commit -m "feat(bi): agregação pura da reconversão com período anterior, funil, níveis e top cupons

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: BI — KPIs com hierarquia (herói + compactos)

**Files:**
- Create: `src/components/dashboard/reconversao/KpiHero.tsx`
- Modify: `src/components/dashboard/BIProReconversaoTab.tsx` (substituir os dois `GRID_KPIS_3`)

**Interfaces:**
- `KpiHero({ agregado: Agregado })` (Task 8) usando `StatCard` (Task 2).

- [ ] **Step 1: Componente**

```tsx
// src/components/dashboard/reconversao/KpiHero.tsx
import { Clock, DollarSign, Target, Users, Zap } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { StatCard } from '@/components/ui/stat-card';
import { fmtBRL } from '@/components/dashboard/bipro-shared';
import type { Agregado } from '@/lib/bi/reconversao';
import { chartTheme } from '@/lib/chartTheme';

const pct = (v: number | null) => (v === null ? '—' : `${(v * 100).toFixed(1)}%`);
const horas = (h: number | null) => (h === null ? '—' : h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${h.toFixed(1)} h` : `${(h / 24).toFixed(1)} d`);

export default function KpiHero({ agregado: a }: { agregado: Agregado }) {
  const { atual, deltas, porNivel } = a;
  const nivelTotal = porNivel.cupom + porNivel.clique + porNivel.janela || 1;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr_1fr] gap-4">
        <StatCard size="hero" icon={DollarSign} label="Receita recuperada" value={fmtBRL(atual.receita)}
          delta={{ value: deltas.receita, label: 'vs. período anterior' }}
          sub={atual.ticketMedio !== null ? `ticket médio ${fmtBRL(atual.ticketMedio)} · ${atual.reconvertidos} pedidos` : 'nenhum pedido atribuído ainda'}>
          {a.porDia.length > 1 && (
            <div className="h-12 -mx-1 mt-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={a.porDia} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                  <Area type="monotone" dataKey="receita" stroke={chartTheme.colors.primary} strokeWidth={1.5} fill={chartTheme.colors.primary} fillOpacity={0.08} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </StatCard>
        <StatCard icon={Target} label="Reconvertidos por nós" value={String(atual.reconvertidos)}
          delta={{ value: deltas.reconvertidos }} sub={`${atual.organicos} orgânicos fora da conta`}>
          <div className="space-y-1.5 mt-1">
            <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-muted" aria-hidden>
              <div className="bg-emerald-500" style={{ width: `${(porNivel.cupom / nivelTotal) * 100}%` }} />
              <div className="bg-sky-500" style={{ width: `${(porNivel.clique / nivelTotal) * 100}%` }} />
              <div className="bg-amber-500" style={{ width: `${(porNivel.janela / nivelTotal) * 100}%` }} />
            </div>
            <div className="flex gap-3 text-[11px] text-muted-foreground tabular-nums">
              <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1" />cupom {porNivel.cupom}</span>
              <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-sky-500 mr-1" />clique {porNivel.clique}</span>
              <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 mr-1" />janela {porNivel.janela}</span>
            </div>
          </div>
        </StatCard>
        <StatCard icon={Zap} label="Taxa de reconversão" value={pct(atual.taxa)} delta={{ value: deltas.taxa }}
          sub={`${atual.reconvertidos} de ${atual.leadsTocados} leads tocados`} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard size="compact" icon={Users} label="Leads tocados" value={String(atual.leadsTocados)} sub="receberam ≥ 1 toque no período" />
        <StatCard size="compact" label="Toques enviados" value={String(atual.toques.total)}
          sub={`e-mail ${atual.toques.email} · WhatsApp ${atual.toques.whatsapp} · SMS ${atual.toques.sms}`} />
        <StatCard size="compact" icon={Clock} label="Tempo até converter" value={horas(atual.horasMedias)}
          delta={{ value: deltas.horas, invert: true }} sub="média do último toque ao pagamento" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Usar na tab** — em `BIProReconversaoTab.tsx`, apague os dois blocos `<div className={GRID_KPIS_3}>…</div>` e o `KpiCard` local; renderize `<KpiHero agregado={data.agregado} />` no lugar. Ajuste o skeleton de carregamento para `[hero+2] + [3 compactos]` (`SkeletonBlock height={160}` ×3 e `height={84}` ×3). Remova imports não usados.

- [ ] **Step 3: Verificar e commitar**

Run: `npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep -E "KpiHero|BIProReconversaoTab"; echo TSC-OK; npm run build 2>&1 | tail -1`
Visual (`/dashboard`, aba Reconversão, período com dados): receita em destaque com sparkline e delta; barra de níveis; três compactos.

```bash
git add src/components/dashboard/reconversao/KpiHero.tsx src/components/dashboard/BIProReconversaoTab.tsx
git commit -m "feat(bi): KPIs com hierarquia — receita herói com sparkline, níveis e deltas

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: BI — funil e receita por nível de atribuição

**Files:**
- Create: `src/components/dashboard/reconversao/FunnelCard.tsx`
- Create: `src/components/dashboard/reconversao/AttributionCard.tsx`
- Modify: `src/components/dashboard/BIProReconversaoTab.tsx` (grid 2 colunas entre KPIs e série diária)

- [ ] **Step 1: FunnelCard**

```tsx
// src/components/dashboard/reconversao/FunnelCard.tsx
import type { Agregado } from '@/lib/bi/reconversao';

export default function FunnelCard({ funil }: { funil: Agregado['funil'] }) {
  const steps = [
    { label: 'Leads tocados', value: funil.tocados, hint: 'receberam pelo menos um toque' },
    { label: 'Clicaram no link', value: funil.clicaram, hint: 'abriram o carrinho por um link nosso' },
    { label: 'Pagaram', value: funil.pagaram, hint: 'pedido pago atribuído à esteira' },
  ];
  const max = Math.max(1, ...steps.map((s) => s.value));
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <p className="text-[13px] font-medium text-foreground">Funil de recuperação</p>
      <div className="space-y-3">
        {steps.map((s, i) => {
          const prev = i > 0 ? steps[i - 1].value : null;
          const conv = prev ? Math.round((s.value / prev) * 100) : null;
          return (
            <div key={s.label} className="space-y-1">
              <div className="flex items-baseline justify-between text-[12px]">
                <span className="text-foreground">{s.label} <span className="text-muted-foreground">· {s.hint}</span></span>
                <span className="tabular-nums font-semibold text-foreground">{s.value}{conv !== null && <span className="ml-2 text-[11px] font-normal text-muted-foreground">{conv}% da etapa anterior</span>}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden" aria-hidden>
                <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${(s.value / max) * 100}%`, opacity: 1 - i * 0.25 }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: AttributionCard**

```tsx
// src/components/dashboard/reconversao/AttributionCard.tsx
import { fmtBRL } from '@/components/dashboard/bipro-shared';
import type { Agregado } from '@/lib/bi/reconversao';

const NIVEIS = [
  { key: 'cupom', label: 'Cupom nosso', cls: 'bg-emerald-500', hint: 'prova forte' },
  { key: 'clique', label: 'Clique rastreado', cls: 'bg-sky-500', hint: 'prova forte' },
  { key: 'janela', label: 'Janela de 7 dias', cls: 'bg-amber-500', hint: 'atribuição temporal' },
  { key: 'organico', label: 'Orgânico', cls: 'bg-muted-foreground/40', hint: 'sem toque nosso' },
] as const;

export default function AttributionCard({ receita, topCupons }: { receita: Agregado['porNivelReceita']; topCupons: Agregado['topCupons'] }) {
  const total = NIVEIS.reduce((a, n) => a + receita[n.key], 0) || 1;
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-baseline justify-between">
        <p className="text-[13px] font-medium text-foreground">Receita por prova de atribuição</p>
        <span className="text-[11px] text-muted-foreground tabular-nums">{fmtBRL(total)} pagos no período</span>
      </div>
      <div className="flex h-3 w-full rounded-full overflow-hidden bg-muted" aria-hidden>
        {NIVEIS.map((n) => <div key={n.key} className={n.cls} style={{ width: `${(receita[n.key] / total) * 100}%` }} />)}
      </div>
      <ul className="space-y-1.5">
        {NIVEIS.map((n) => (
          <li key={n.key} className="flex items-center justify-between text-[12px]">
            <span className="flex items-center gap-2 text-foreground"><span className={`inline-block w-2 h-2 rounded-full ${n.cls}`} />{n.label} <span className="text-muted-foreground">· {n.hint}</span></span>
            <span className="tabular-nums text-foreground">{fmtBRL(receita[n.key])} <span className="text-muted-foreground">({Math.round((receita[n.key] / total) * 100)}%)</span></span>
          </li>
        ))}
      </ul>
      {topCupons.length > 0 && (
        <div className="pt-3 border-t border-border">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1.5">Cupons que mais recuperaram</p>
          <ul className="space-y-1">
            {topCupons.map((c) => (
              <li key={c.code} className="flex items-center justify-between text-[12px]">
                <span className="font-mono text-foreground">{c.code}</span>
                <span className="tabular-nums text-muted-foreground">{c.pedidos} pedido{c.pedidos === 1 ? '' : 's'} · {fmtBRL(c.receita)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Montar** — na tab, após `<KpiHero />`:

```tsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
  <FunnelCard funil={data.agregado.funil} />
  <AttributionCard receita={data.agregado.porNivelReceita} topCupons={data.agregado.topCupons} />
</div>
```

- [ ] **Step 4: Verificar e commitar**

Run: `npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep -E "FunnelCard|AttributionCard|BIProReconversaoTab"; echo TSC-OK; npm run build 2>&1 | tail -1`

```bash
git add src/components/dashboard/reconversao/FunnelCard.tsx src/components/dashboard/reconversao/AttributionCard.tsx src/components/dashboard/BIProReconversaoTab.tsx
git commit -m "feat(bi): funil de recuperação e receita por nível de atribuição

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11: BI — série diária com receita (ComposedChart) e tema

**Files:**
- Create: `src/components/dashboard/reconversao/DailyChart.tsx`
- Modify: `src/components/dashboard/BIProReconversaoTab.tsx` (substituir o bloco `AreaChart`)

- [ ] **Step 1: Componente**

```tsx
// src/components/dashboard/reconversao/DailyChart.tsx
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { fmtBRL } from '@/components/dashboard/bipro-shared';
import { chartTheme } from '@/lib/chartTheme';
import type { Agregado } from '@/lib/bi/reconversao';

export default function DailyChart({ porDia }: { porDia: Agregado['porDia'] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-[13px] font-medium text-foreground">Reconversões e receita por dia</p>
        <div className="flex gap-3 text-[11px] text-muted-foreground">
          <span><span className="inline-block w-2 h-2 rounded-sm bg-muted-foreground/30 mr-1" />receita</span>
          <span><span className="inline-block w-2 h-0.5 bg-primary mr-1 align-middle" />reconversões</span>
        </div>
      </div>
      {porDia.length === 0 ? (
        <p className="text-[12px] text-muted-foreground py-10 text-center">Nenhuma reconversão atribuída no período. Dispare a esteira e volte aqui — cada pedido pago após um toque aparece neste gráfico.</p>
      ) : (
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={porDia} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridStroke} vertical={false} />
              <XAxis dataKey="dia" tickFormatter={(d: string) => format(new Date(`${d}T12:00:00`), 'dd/MM')} tick={chartTheme.axisTick} axisLine={false} tickLine={false} />
              <YAxis yAxisId="rec" allowDecimals={false} tick={chartTheme.axisTick} axisLine={false} tickLine={false} width={28} />
              <YAxis yAxisId="rev" orientation="right" tickFormatter={(v: number) => `R$${Math.round(v / 100) / 10}k`} tick={chartTheme.axisTick} axisLine={false} tickLine={false} width={48} />
              <Tooltip contentStyle={chartTheme.tooltipStyle} labelStyle={chartTheme.tooltipLabelStyle}
                formatter={(value: number, name: string) => (name === 'receita' ? [fmtBRL(value), 'Receita'] : [value, 'Reconversões'])}
                labelFormatter={(d: string) => format(new Date(`${d}T12:00:00`), "dd 'de' MMMM", { locale: ptBR })} />
              <Bar yAxisId="rev" dataKey="receita" fill={chartTheme.colors.muted} fillOpacity={0.25} radius={[6, 6, 0, 0]} />
              <Line yAxisId="rec" type="monotone" dataKey="reconversoes" stroke={chartTheme.colors.primary} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: chartTheme.colors.primary }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Substituir na tab** — troque o `motion.div` da série diária por `<motion.div variants={cardV}><DailyChart porDia={data.agregado.porDia} /></motion.div>`; remova imports de recharts que sobraram.

- [ ] **Step 3: Verificar e commitar**

Run: `npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep -E "DailyChart|BIProReconversaoTab"; echo TSC-OK; npm run build 2>&1 | tail -1; grep -rn "borderRadius: 4" src/components/dashboard/ && echo "AINDA HÁ RAIO 4" || echo "raio ok"`

```bash
git add src/components/dashboard/reconversao/DailyChart.tsx src/components/dashboard/BIProReconversaoTab.tsx
git commit -m "feat(bi): série diária com receita (barras) + reconversões (linha) no tema do design

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 12: BI — tabela com filtros, ordenação, paginação, CSV e clique

**Files:**
- Create: `src/components/dashboard/reconversao/ReconversionsTable.tsx`
- Modify: `src/components/dashboard/BIProReconversaoTab.tsx` (substituir a tabela)

**Interfaces:**
- `ReconversionsTable({ rows: ReconversionRow[] })` — `ReconversionRow` de `@/hooks/useReconversaoBI` (tem `lead_id`, `pessoa?.name`).
- Helper exportado `toCsv(rows: ReconversionRow[]): string` (testável).

- [ ] **Step 1: Teste do CSV**

```ts
// src/components/dashboard/reconversao/ReconversionsTable.test.ts
import { describe, expect, it } from 'vitest';
import { toCsv } from './ReconversionsTable';

describe('toCsv', () => {
  it('escapa aspas e usa ; como separador', () => {
    const csv = toCsv([{ id: '1', order_id: '10', people_id: null, lead_id: null, order_total: 99.9, paid_at: '2026-09-02T12:00:00Z', last_touch_at: null, touches_email: 1, touches_whatsapp: 0, touches_sms: 0, touches_total: 1, hours_since_last_touch: 2, attributed: true, attribution_level: 'cupom', coupon_code: 'VOLTA10', pessoa: { name: 'Ana "A"' } } as never]);
    expect(csv.split('\n')[0]).toBe('cliente;pedido;valor;pago_em;atribuicao;cupom;toques_email;toques_whatsapp;toques_sms;horas_ultimo_toque');
    expect(csv.split('\n')[1]).toContain('"Ana ""A""";10;99.9;');
  });
});
```

- [ ] **Step 2: Componente**

```tsx
// src/components/dashboard/reconversao/ReconversionsTable.tsx
import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, CheckCircle2, Download, Mail, MessageSquare, Smartphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { cn } from '@/lib/utils';
import { fmtBRL, TABLE_HEADER } from '@/components/dashboard/bipro-shared';
import type { ReconversionRow } from '@/hooks/useReconversaoBI';

type Filtro = 'todos' | 'atribuidos' | 'organicos' | 'cupom' | 'clique' | 'janela';
type Ordem = { by: 'paid_at' | 'order_total'; dir: 'asc' | 'desc' };
const PAGE = 25;

const csvCell = (v: unknown) => { const s = v === null || v === undefined ? '' : String(v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function toCsv(rows: ReconversionRow[]): string {
  const head = ['cliente', 'pedido', 'valor', 'pago_em', 'atribuicao', 'cupom', 'toques_email', 'toques_whatsapp', 'toques_sms', 'horas_ultimo_toque'];
  const lines = rows.map((r) => [r.pessoa?.name ?? '', r.order_id, r.order_total ?? '', r.paid_at, r.attributed ? r.attribution_level ?? '' : 'organico', r.coupon_code ?? '', r.touches_email, r.touches_whatsapp, r.touches_sms, r.hours_since_last_touch ?? ''].map(csvCell).join(';'));
  return [head.join(';'), ...lines].join('\n');
}

const fmtHoras = (h: number | null) => (h === null ? '—' : h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${h.toFixed(1)} h` : `${(h / 24).toFixed(1)} d`);

export default function ReconversionsTable({ rows }: { rows: ReconversionRow[] }) {
  const navigate = useNavigate();
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [ordem, setOrdem] = useState<Ordem>({ by: 'paid_at', dir: 'desc' });
  const [page, setPage] = useState(1);

  const visiveis = useMemo(() => {
    const f = rows.filter((r) => filtro === 'todos' ? true : filtro === 'atribuidos' ? r.attributed : filtro === 'organicos' ? !r.attributed : r.attribution_level === filtro);
    return [...f].sort((a, b) => {
      const va = ordem.by === 'paid_at' ? a.paid_at : (a.order_total ?? 0);
      const vb = ordem.by === 'paid_at' ? b.paid_at : (b.order_total ?? 0);
      return (va < vb ? -1 : va > vb ? 1 : 0) * (ordem.dir === 'asc' ? 1 : -1);
    });
  }, [rows, filtro, ordem]);
  const pages = Math.max(1, Math.ceil(visiveis.length / PAGE));
  const slice = visiveis.slice((page - 1) * PAGE, page * PAGE);

  const toggle = (by: Ordem['by']) => { setOrdem((o) => ({ by, dir: o.by === by && o.dir === 'desc' ? 'asc' : 'desc' })); setPage(1); };
  const exportar = () => {
    const blob = new Blob(['﻿' + toCsv(visiveis)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `reconversoes-${format(new Date(), 'yyyyMMdd')}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };
  const SortIcon = ({ by }: { by: Ordem['by'] }) => ordem.by !== by ? null : ordem.dir === 'asc' ? <ArrowUp className="inline h-3 w-3 ml-0.5" /> : <ArrowDown className="inline h-3 w-3 ml-0.5" />;

  const FILTROS: Array<{ k: Filtro; label: string }> = [
    { k: 'todos', label: 'Todos' }, { k: 'atribuidos', label: 'Atribuídos' }, { k: 'organicos', label: 'Orgânicos' },
    { k: 'cupom', label: 'Cupom' }, { k: 'clique', label: 'Clique' }, { k: 'janela', label: 'Janela' },
  ];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex flex-wrap items-center gap-2">
        <p className="text-[13px] font-medium text-foreground mr-2">Pedidos pagos no período</p>
        <div className="flex gap-1">
          {FILTROS.map((f) => (
            <button key={f.k} type="button" onClick={() => { setFiltro(f.k); setPage(1); }}
              className={cn('text-[11px] px-2 py-0.5 rounded-full border transition-colors', filtro === f.k ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground border-border hover:text-foreground')}>
              {f.label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">{visiveis.length} pedidos</span>
        <Button variant="outline" size="sm" className="h-7 gap-1.5 text-[11.5px]" onClick={exportar} disabled={visiveis.length === 0}>
          <Download className="h-3.5 w-3.5" strokeWidth={1.5} />CSV
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-border">
              <th className={cn(TABLE_HEADER, 'text-left px-4 py-2')}>Cliente</th>
              <th className={cn(TABLE_HEADER, 'text-left px-4 py-2')}>Toques</th>
              <th className={cn(TABLE_HEADER, 'text-left px-4 py-2')}>Último toque → pagou</th>
              <th className={cn(TABLE_HEADER, 'text-right px-4 py-2 cursor-pointer select-none')} onClick={() => toggle('order_total')}>Valor<SortIcon by="order_total" /></th>
              <th className={cn(TABLE_HEADER, 'text-left px-4 py-2 cursor-pointer select-none')} onClick={() => toggle('paid_at')}>Pago em<SortIcon by="paid_at" /></th>
              <th className={cn(TABLE_HEADER, 'text-left px-4 py-2')}>Atribuição</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {slice.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-[12px]">Nenhum pedido neste filtro.</td></tr>
            ) : slice.map((r) => (
              <tr key={r.id} onClick={() => r.lead_id && navigate(`/crm/kanban/${r.lead_id}`)}
                className={cn(r.lead_id && 'cursor-pointer hover:bg-muted/40', !r.attributed && 'opacity-70')}>
                <td className="px-4 py-2.5 text-foreground truncate max-w-[220px]">{r.pessoa?.name ?? '—'}<span className="text-muted-foreground/50 text-[11px] ml-2">#{r.order_id}</span></td>
                <td className="px-4 py-2.5">
                  <div className="flex gap-1">
                    {r.touches_email > 0 && <Chip tone="info" icon={Mail}>{r.touches_email}</Chip>}
                    {r.touches_whatsapp > 0 && <Chip tone="success" icon={MessageSquare}>{r.touches_whatsapp}</Chip>}
                    {r.touches_sms > 0 && <Chip tone="violet" icon={Smartphone}>{r.touches_sms}</Chip>}
                    {r.touches_total === 0 && <span className="text-muted-foreground/50 text-[11px]">—</span>}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{fmtHoras(r.hours_since_last_touch)}</td>
                <td className="px-4 py-2.5 text-right font-medium text-foreground tabular-nums">{r.order_total !== null ? fmtBRL(r.order_total) : '—'}</td>
                <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{format(new Date(r.paid_at), 'dd/MM/yy HH:mm', { locale: ptBR })}</td>
                <td className="px-4 py-2.5">
                  {r.attributed ? (
                    <Chip size="md" icon={CheckCircle2} tone={r.attribution_level === 'cupom' ? 'success' : r.attribution_level === 'clique' ? 'info' : 'warning'}
                      title={r.attribution_level === 'cupom' ? `Usou o nosso cupom ${r.coupon_code ?? ''}` : r.attribution_level === 'clique' ? 'Clicou em link rastreado nosso antes de pagar' : 'Recebeu toque antes de pagar (janela de 7 dias)'}>
                      {r.attribution_level === 'cupom' ? `Cupom ${r.coupon_code ?? ''}` : r.attribution_level === 'clique' ? 'Clique rastreado' : 'Janela 7d'}
                    </Chip>
                  ) : <Chip size="md">Orgânico</Chip>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="px-4 py-2.5 border-t border-border flex items-center justify-between text-[11.5px] text-muted-foreground">
          <span className="tabular-nums">página {page} de {pages}</span>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="h-7 text-[11.5px]" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
            <Button variant="ghost" size="sm" className="h-7 text-[11.5px]" disabled={page === pages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Substituir na tab** — troque o `motion.div` da tabela por `<motion.div variants={cardV}><ReconversionsTable rows={data.rows} /></motion.div>`; remova `TouchIcons` e imports órfãos.

- [ ] **Step 4: Verificar e commitar**

Run: `npm test; npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep -E "ReconversionsTable|BIProReconversaoTab"; echo TSC-OK; npm run build 2>&1 | tail -1`

```bash
git add src/components/dashboard/reconversao/ReconversionsTable.tsx src/components/dashboard/reconversao/ReconversionsTable.test.ts src/components/dashboard/BIProReconversaoTab.tsx
git commit -m "feat(bi): tabela de reconversões com filtros, ordenação, paginação, CSV e clique no lead

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 13: BI — faixa de insights

**Files:**
- Create: `src/lib/bi/insights.ts` (+ `insights.test.ts`)
- Create: `src/components/dashboard/reconversao/InsightsStrip.tsx`
- Modify: `src/components/dashboard/BIProReconversaoTab.tsx` (entre KPIs e funil)

**Interfaces:**
- `buildInsights(a: Agregado): string[]` — no máximo 3 frases; só quando houver base (`n ≥ 3` para proporções).

- [ ] **Step 1: Teste**

```ts
// src/lib/bi/insights.test.ts
import { describe, expect, it } from 'vitest';
import { buildInsights } from './insights';
import type { Agregado } from './reconversao';

const base: Agregado = {
  atual: { reconvertidos: 7, organicos: 3, receita: 1000, ticketMedio: 142.8, leadsTocados: 100, taxa: 0.07, horasMedias: 20, toques: { email: 20, whatsapp: 5, sms: 3, total: 28 } },
  anterior: { reconvertidos: 4, organicos: 2, receita: 600, ticketMedio: 150, leadsTocados: 90, taxa: 0.044, horasMedias: 30, toques: { email: 10, whatsapp: 2, sms: 1, total: 13 } },
  deltas: { receita: 0.66, reconvertidos: 0.75, taxa: 0.59, horas: -0.33 },
  porNivel: { cupom: 4, clique: 2, janela: 1 },
  porNivelReceita: { cupom: 620, clique: 280, janela: 100, organico: 400 },
  funil: { tocados: 100, clicaram: 20, pagaram: 7 },
  porCanalUltimoToque: { email: 5, whatsapp: 2, sms: 0 },
  porDia: [], topCupons: [{ code: 'VOLTA10', pedidos: 4, receita: 620 }],
};

describe('buildInsights', () => {
  it('gera até 3 frases com dados suficientes', () => {
    const s = buildInsights(base);
    expect(s.length).toBeLessThanOrEqual(3);
    expect(s.some((x) => x.includes('VOLTA10'))).toBe(true);
    expect(s.some((x) => x.toLowerCase().includes('e-mail'))).toBe(true);
  });
  it('sem base, não inventa', () => {
    expect(buildInsights({ ...base, atual: { ...base.atual, reconvertidos: 1 }, porNivel: { cupom: 1, clique: 0, janela: 0 }, porCanalUltimoToque: { email: 1, whatsapp: 0, sms: 0 }, topCupons: [], deltas: { receita: null, reconvertidos: null, taxa: null, horas: null } })).toEqual([]);
  });
});
```

- [ ] **Step 2: Implementar**

```ts
// src/lib/bi/insights.ts
import type { Agregado } from './reconversao';

const pct = (n: number, d: number) => Math.round((n / d) * 100);
const CANAL = { email: 'E-mail', whatsapp: 'WhatsApp', sms: 'SMS' } as const;

/** Frases curtas e verificáveis a partir dos agregados. Nunca especula: só com n ≥ 3. */
export function buildInsights(a: Agregado): string[] {
  const out: string[] = [];
  const total = a.atual.reconvertidos;
  if (total >= 3 && a.topCupons[0]) {
    const c = a.topCupons[0];
    const receitaAtrib = a.porNivelReceita.cupom + a.porNivelReceita.clique + a.porNivelReceita.janela;
    if (receitaAtrib > 0) out.push(`${c.code} respondeu por ${pct(c.receita, receitaAtrib)}% da receita recuperada (${c.pedidos} pedidos).`);
  }
  if (total >= 3) {
    const [canal, n] = (Object.entries(a.porCanalUltimoToque) as Array<[keyof typeof CANAL, number]>).sort((x, y) => y[1] - x[1])[0];
    if (n >= 2) out.push(`${CANAL[canal]} foi o canal decisivo em ${n} de ${total} recuperações.`);
  }
  if (a.deltas.horas !== null && a.anterior.reconvertidos >= 3 && total >= 3) {
    const v = Math.round(Math.abs(a.deltas.horas) * 100);
    if (v >= 10) out.push(`Tempo médio até pagar ${a.deltas.horas < 0 ? 'caiu' : 'subiu'} ${v}% vs. período anterior.`);
  }
  if (out.length < 3 && a.funil.tocados >= 20 && a.funil.clicaram >= 3) {
    out.push(`${pct(a.funil.clicaram, a.funil.tocados)}% dos tocados clicaram no link; ${pct(a.funil.pagaram, a.funil.clicaram)}% dos que clicaram pagaram.`);
  }
  return out.slice(0, 3);
}
```

- [ ] **Step 3: Componente e montagem**

```tsx
// src/components/dashboard/reconversao/InsightsStrip.tsx
import { Sparkles } from 'lucide-react';
import { buildInsights } from '@/lib/bi/insights';
import type { Agregado } from '@/lib/bi/reconversao';

export default function InsightsStrip({ agregado }: { agregado: Agregado }) {
  const frases = buildInsights(agregado);
  if (frases.length === 0) return null;
  return (
    <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 flex flex-wrap gap-x-6 gap-y-1.5 items-center">
      <Sparkles className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.5} aria-hidden />
      {frases.map((f) => <p key={f} className="text-[12px] text-foreground">{f}</p>)}
    </div>
  );
}
```
Na tab: `<InsightsStrip agregado={data.agregado} />` logo abaixo de `<KpiHero />`.

- [ ] **Step 4: Verificar e commitar**

Run: `npm test; npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep -E "insights|InsightsStrip|BIProReconversaoTab"; echo TSC-OK`

```bash
git add src/lib/bi/insights.ts src/lib/bi/insights.test.ts src/components/dashboard/reconversao/InsightsStrip.tsx src/components/dashboard/BIProReconversaoTab.tsx
git commit -m "feat(bi): faixa de insights gerados dos agregados (só com base estatística)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 14: Período padrão `30d` no Dashboard

**Files:**
- Modify: `src/pages/Dashboard.tsx` (estado inicial linha ~43, `reconvRange` linhas ~88–108)
- Modify: `src/components/dashboard/DashboardFilters.tsx` (opção `30d` no select de período — localize o `SelectItem value="90d"` e adicione antes dele)

- [ ] **Step 1: Dashboard** — `useState('today')` → `useState('30d')` para o estado inicial **e** no `handleClearFilters` (linha ~49 `setPeriodFilter('today')` → `'30d'`). Em `reconvRange`, adicione o case: `case '30d': { const from = startOfDay(now); from.setDate(from.getDate() - 30); return { from, to: now }; }`. Se o `biProPeriod` dos outros BIs não conhecer `'30d'`, mapeie: `const biProPeriod = periodFilter === '30d' ? 'month' : periodFilter !== 'personalizado' ? periodFilter : undefined;`.

- [ ] **Step 2: DashboardFilters** — adicione `<SelectItem value="30d">Últimos 30 dias</SelectItem>` antes de `90d`.

- [ ] **Step 3: Verificar e commitar**

Run: `npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep -E "Dashboard.tsx|DashboardFilters"; echo TSC-OK; npm run build 2>&1 | tail -1`
Visual: abrir `/dashboard` → período "Últimos 30 dias" selecionado e BI com dados.

```bash
git add src/pages/Dashboard.tsx src/components/dashboard/DashboardFilters.tsx
git commit -m "feat(dashboard): preset 'Últimos 30 dias' como padrão da Reconversão

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 15: Aba Esteira — cabeçalho com ações, timeline por dia, carrinho com variação

**Files:**
- Modify: `src/hooks/useEsteiraLead.ts` (`parseYampiCart` → incluir `image`, `variations`, `etapaAbandono`; `TimelineEntry` ganha `templateName?`; novo `useCancelPendingTouches(leadId)`)
- Modify: `src/components/negocios/NegocioEsteira.tsx`

**Interfaces:**
- `LeadCart` ganha `image: string | null; variations: Array<{ name: string; value: string }>; etapaAbandono: 'cadastro'|'frete'|'pagamento'|null`.
- `useCancelPendingTouches(leadId: string)` → `useMutation` que faz `update({ status: 'cancelled', error_message: 'cancelado pelo operador' }).eq('lead_id', leadId).eq('status', 'pending')` e invalida `['esteira']`. Erro de RLS deve virar `toast.error('Sem permissão para pausar — peça a um gestor')`.
- Helper puro `groupByDay(entries: TimelineEntry[]): Array<{ label: string; items: TimelineEntry[] }>` em `src/lib/esteira/timeline.ts` (testado): rótulos "Hoje", "Ontem", `dd/MM`.

- [ ] **Step 1: Teste do agrupamento**

```ts
// src/lib/esteira/timeline.test.ts
import { describe, expect, it } from 'vitest';
import { groupByDay } from './timeline';

describe('groupByDay', () => {
  it('agrupa por dia com rótulos relativos', () => {
    const now = new Date('2026-09-03T15:00:00-03:00');
    const g = groupByDay([
      { id: '1', at: '2026-09-03T10:00:00-03:00', kind: 'toque', type: 'email', title: 'E1' },
      { id: '2', at: '2026-09-02T10:00:00-03:00', kind: 'evento', type: 'carrinho_abandonado', title: 'Carrinho' },
      { id: '3', at: '2026-08-30T10:00:00-03:00', kind: 'toque', type: 'sms', title: 'SMS' },
    ], now);
    expect(g.map((x) => x.label)).toEqual(['Hoje', 'Ontem', '30/08']);
    expect(g[0].items[0].id).toBe('1');
  });
});
```

- [ ] **Step 2: Implementar helper**

```ts
// src/lib/esteira/timeline.ts
import { format, isSameDay, subDays } from 'date-fns';
import type { TimelineEntry } from '@/hooks/useEsteiraLead';

export function groupByDay(entries: TimelineEntry[], now = new Date()): Array<{ label: string; items: TimelineEntry[] }> {
  const groups = new Map<string, { label: string; items: TimelineEntry[] }>();
  for (const e of entries) {
    const d = new Date(e.at);
    const key = format(d, 'yyyy-MM-dd');
    const label = isSameDay(d, now) ? 'Hoje' : isSameDay(d, subDays(now, 1)) ? 'Ontem' : format(d, 'dd/MM');
    (groups.get(key) ?? groups.set(key, { label, items: [] }).get(key)!).items.push(e);
  }
  return [...groups.entries()].sort(([a], [b]) => (a > b ? -1 : 1)).map(([, v]) => v);
}
```

- [ ] **Step 3: Hook** — em `useEsteiraLead.ts`:
  - `parseYampiCart`: leia `resource.items.data[0].sku.data.images?.data?.[0]?.url` (ou `.src`) como `image`; `sku.data.variations` (array `{name,value}`) como `variations`; `resource.search.data.abandoned_step` mapeado para `'cadastro'|'frete'|'pagamento'|null` (`personal_info`→cadastro, `shippment`→frete, `payment`→pagamento). Retorne esses campos e amplie `LeadCart`.
  - Nas entradas de toque, preencha `templateName: tplName ?? null` (já resolvido ali como `tplName`).
  - Novo hook:
```ts
export function useCancelPendingTouches(leadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error, count } = await db.from('followup_queue')
        .update({ status: 'cancelled', error_message: 'cancelado pelo operador' }, { count: 'exact' })
        .eq('lead_id', leadId).eq('status', 'pending');
      if (error) throw error;
      return count ?? 0;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['esteira'] }),
  });
}
```
(importe `useMutation`, `useQueryClient` de `@tanstack/react-query`).

- [ ] **Step 4: Componente** — em `NegocioEsteira.tsx`:
  - Acima do card do carrinho, um cabeçalho:
```tsx
const next = timeline.filter((t) => t.kind === 'toque' && t.status === 'pending').sort((a, b) => (a.at < b.at ? -1 : 1))[0];
const total = sentCount + pendingCount + timeline.filter((t) => t.kind === 'toque' && t.status === 'failed').length;
const cancel = useCancelPendingTouches(leadId);
…
<div className="rounded-xl border border-border bg-card p-4 flex flex-wrap items-center gap-3">
  <div className="min-w-0 flex-1">
    <p className="text-[13px] font-medium text-foreground">{total > 0 ? `${sentCount} de ${total} toques enviados` : 'Sem toques agendados'}</p>
    <p className="text-[11.5px] text-muted-foreground truncate">
      {next ? `Próximo: ${next.templateName ?? next.title} · ${formatDistanceToNow(new Date(next.at), { locale: ptBR, addSuffix: true })}` : pendingCount === 0 && total > 0 ? 'Esteira concluída' : ''}
    </p>
    {total > 0 && <div className="mt-2 h-1 w-full max-w-[280px] rounded-full bg-muted overflow-hidden" aria-hidden><div className="h-full bg-primary rounded-full" style={{ width: `${Math.round((sentCount / total) * 100)}%` }} /></div>}
  </div>
  {cart?.url && <Button variant="outline" size="sm" className="h-8 text-[12px]" onClick={() => { navigator.clipboard.writeText(cart.url!); toast.success('Link copiado'); }}>Copiar link do carrinho</Button>}
  {pendingCount > 0 && (
    <Button variant="outline" size="sm" className="h-8 text-[12px] text-destructive hover:text-destructive" disabled={cancel.isPending}
      onClick={() => { if (window.confirm(`Pausar ${pendingCount} toque(s) pendente(s) deste lead? Eles serão cancelados.`)) cancel.mutate(undefined, { onSuccess: (n) => toast.success(`${n} toque(s) cancelado(s)`), onError: (e) => toast.error(/permission|policy|RLS/i.test((e as Error).message) ? 'Sem permissão para pausar — peça a um gestor' : (e as Error).message) }); }}>
      Pausar toques
    </Button>
  )}
</div>
```
  - No card do carrinho: se `cart.image`, mostre `<img src={cart.image} alt="" className="w-14 h-14 rounded-lg object-cover bg-muted" />` à esquerda do título; abaixo do título, chips `cart.variations.map(v => <Chip key={v.name}>{v.name}: {v.value}</Chip>)` e, se `cart.etapaAbandono`, `<Chip tone="warning">parou em: {cart.etapaAbandono}</Chip>`.
  - Timeline: substitua `timeline.map(...)` por `groupByDay(timeline).map((g) => (<div key={g.label}><p className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground/70 mb-2 mt-1">{g.label}</p>{g.items.map(...)}</div>))`; para toques use `e.templateName ?? e.title` como título e mostre hora `HH:mm` (a data já está no separador).

- [ ] **Step 5: Verificar e commitar**

Run: `npm test; npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep -E "NegocioEsteira|useEsteiraLead|lib/esteira/timeline"; echo TSC-OK; npm run build 2>&1 | tail -1`
Visual: abrir um lead da esteira — cabeçalho com progresso e próximo toque, botões; timeline com "Hoje/Ontem/dd/MM".

```bash
git add src/lib/esteira/timeline.ts src/lib/esteira/timeline.test.ts src/hooks/useEsteiraLead.ts src/components/negocios/NegocioEsteira.tsx
git commit -m "feat(esteira): cabeçalho com progresso/ações, timeline por dia e carrinho com imagem e variação

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 16: QA final, limpeza e push

**Files:**
- Modify: `src/components/negocios/StageColumn.tsx`, `src/components/dashboard/BIProReconversaoTab.tsx` (remover código morto)
- Modify: `src/hooks/useEsteiraLead.ts` (remover `useTouchCountsByLead` **somente se** nenhum arquivo mais o importar)

- [ ] **Step 1: Varredura de chips inline** — `grep -rn "rounded-full border leading-none" src/components/negocios/StageColumn.tsx src/components/dashboard/BIProReconversaoTab.tsx` deve retornar vazio; se sobrar algum, troque por `Chip`.
- [ ] **Step 2: Código morto** — `grep -rn "useTouchCountsByLead" src` → se só a definição aparecer, remova-a. Rode `npx eslint src/components/negocios src/components/dashboard src/hooks/useEsteiraLead.ts src/hooks/useReconversaoBI.ts src/lib` e corrija erros **novos**.
- [ ] **Step 3: Baseline de tipos** — `git stash; npx tsc -p tsconfig.app.json --noEmit 2>&1 | wc -l; git stash pop; npx tsc -p tsconfig.app.json --noEmit 2>&1 | wc -l` — a contagem depois não pode ser maior que antes.
- [ ] **Step 4: Checklist visual** (claro e escuro, 1280 px e 1536 px):
  - Kanban: faixa do funil; 7 colunas com %; recolher/expandir persiste; card com 4 linhas e ≤ 4 chips; drag mostra anel; Tab/Enter navegam.
  - Toolbar: uma linha; popover de filtros com badge; chips ativos com ×.
  - BI: herói com sparkline e delta; insights (quando há base); funil; receita por nível; gráfico com barras+linha e tooltip arredondado; tabela filtrável/ordenável/paginável; CSV baixa; clique na linha abre o lead.
  - Lead → Esteira: cabeçalho com progresso, próximo toque, botões; timeline agrupada; carrinho com imagem/variação.
  - Nenhuma fonte serifada; nenhum canto reto em cards/tooltips.
- [ ] **Step 5: Build e push**

```bash
npm test && npm run build && git pull -q --rebase origin main && git push origin main
```

---

## Self-review (feito pelo autor do plano)

- **Cobertura da spec:** A1 (Task 1), A2 (Task 2), A3 (Task 1), A4 (Task 0); B1 (Task 4), B2 (Task 5), B3 (Task 6), B4 (Task 7), B5 (Task 4); C1 (Task 8), C2 (Task 9), C3 (Task 10), C4 (Task 11), C5 (Task 12), C6 (Task 13), C7 (Task 14); D1–D3 (Task 15). Limpeza e QA (Task 16).
- **Consistência de nomes:** `Chip` (`tone`, `size`, `icon`, `title`), `StatCard` (`size`, `delta{value,label,invert}`), `summarizeQueue`/`LeadQueueSummary`/`useEsteiraCardData`, `aggregateReconversao`/`Agregado` (`atual`, `anterior`, `deltas`, `porNivel`, `porNivelReceita`, `funil`, `porCanalUltimoToque`, `porDia`, `topCupons`), `buildInsights`, `groupByDay`, `useCancelPendingTouches`, `toCsv`, `productFromTitle` — usados com os mesmos nomes em todas as tarefas.
- **Sem placeholders:** cada passo de código traz o código; passos de integração apontam arquivo, âncora e o que trocar.
