// supabase/functions/_shared/flows/queue-vars.test.ts
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { effectiveVars } from './queue-vars.ts';
Deno.test('linha de regra usa as vars da regra; linha de fluxo usa as vars da fila', () => {
  assertEquals(effectiveVars({ followup_id: 'r1', vars: { cupom_pessoal: true } }, { cupom: 'X' }), { cupom: 'X' });
  assertEquals(effectiveVars({ followup_id: null, vars: { cupom_pessoal: true } }, null), { cupom_pessoal: true });
  assertEquals(effectiveVars({ followup_id: null, vars: null }, null), {});
});

import { bhOnlyFor } from './queue-vars.ts';
Deno.test('horário comercial: regra decide nas linhas de regra; var do nó nas linhas de fluxo', () => {
  assertEquals(bhOnlyFor({ followup_id: 'r', vars: null }, true), true);
  assertEquals(bhOnlyFor({ followup_id: 'r', vars: { business_hours_only: true } }, false), false);
  assertEquals(bhOnlyFor({ followup_id: null, vars: { business_hours_only: true } }, null), true);
  assertEquals(bhOnlyFor({ followup_id: null, vars: {} }, null), false);
});
