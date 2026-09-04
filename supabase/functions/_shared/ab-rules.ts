// supabase/functions/_shared/ab-rules.ts
/** Regras elegíveis pra um lead dado a variante atribuída (null = sem experimento running). Comum (ab_variant_id NULL) sempre entra. */
export interface RuleLike { id: string; ab_variant_id?: string | null }
export function filterRulesForVariant<T extends RuleLike>(rules: T[], variantId: string | null): T[] {
  return rules.filter((r) => r.ab_variant_id == null || r.ab_variant_id === variantId);
}
