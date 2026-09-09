// supabase/functions/_shared/ab-rules.test.ts
// Run: deno test --allow-env supabase/functions/_shared/ab-rules.test.ts
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { filterRulesForVariant } from './ab-rules.ts';

const rules = [
  { id: 'c1', ab_variant_id: null },
  { id: 'a1', ab_variant_id: 'A' },
  { id: 'b1', ab_variant_id: 'B' },
  { id: 'c2' }, // legado sem coluna
];
Deno.test('sem experimento: só regras comuns', () => {
  assertEquals(filterRulesForVariant(rules, null).map((r) => r.id), ['c1', 'c2']);
});
Deno.test('lead em B: comuns + B', () => {
  assertEquals(filterRulesForVariant(rules, 'B').map((r) => r.id), ['c1', 'b1', 'c2']);
});
