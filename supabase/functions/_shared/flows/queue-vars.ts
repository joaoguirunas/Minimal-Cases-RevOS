// supabase/functions/_shared/flows/queue-vars.ts
/** Linhas da fila vindas de fluxo não têm regra: as vars do nó vêm na própria linha. */
export function effectiveVars(entry: { followup_id: string | null; vars?: Record<string, unknown> | null }, ruleVars: Record<string, unknown> | null): Record<string, unknown> {
  return entry.followup_id ? (ruleVars ?? {}) : (entry.vars ?? {});
}
