// supabase/functions/_shared/flows/queue-vars.ts
/** Linhas da fila vindas de fluxo não têm regra: as vars do nó vêm na própria linha. */
/** Segurar para o horário comercial? Linha de regra: flag da regra. Linha de fluxo: opção do nó (vars). */
export function bhOnlyFor(entry: { followup_id: string | null; vars?: Record<string, unknown> | null }, ruleFlag: boolean | null): boolean {
  if (entry.followup_id) return ruleFlag === true;
  const v = entry.vars?.business_hours_only;
  return v === true || v === 'true';
}

export function effectiveVars(entry: { followup_id: string | null; vars?: Record<string, unknown> | null }, ruleVars: Record<string, unknown> | null): Record<string, unknown> {
  return entry.followup_id ? (ruleVars ?? {}) : (entry.vars ?? {});
}
