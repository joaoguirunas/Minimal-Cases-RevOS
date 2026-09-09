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

/**
 * Agrupa negócios por coluna.
 *
 * `fallbackToFirst` (padrão true) é o comportamento de hoje do kanban normal:
 * 1 coluna por stage, nenhum stage fica de fora, e o que sobrar cai na primeira.
 * A visão do comercial cobre só 5 dos 8 stages do pipeline — lá o fallback jogaria
 * um lead em "Pagamento recusado"/"Perdido" dentro de "Carrinhos disponíveis",
 * anunciando como carrinho livre algo que não é. Nesse caso, passe false: quem não
 * casa com nenhuma coluna é descartado (e some também da contagem do cabeçalho).
 */
export function groupByColumn(
  negocios: NegocioOptimized[],
  columns: KanbanColumn[],
  opts: { fallbackToFirst?: boolean } = {},
): Record<string, NegocioOptimized[]> {
  const { fallbackToFirst = true } = opts;
  const byStage = new Map<string, string>();
  for (const c of columns) for (const sid of c.stageIds) byStage.set(sid, c.id);
  const out: Record<string, NegocioOptimized[]> = {};
  for (const c of columns) out[c.id] = [];
  const first = fallbackToFirst ? columns[0]?.id : undefined;
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
