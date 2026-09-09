// supabase/functions/_shared/yampi-coupon.test.ts
// Run: deno test --allow-env supabase/functions/_shared/yampi-coupon.test.ts
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildCouponCode, pickCouponCode, COUPON_PERCENTS_AGENT, COUPON_PERCENTS_COMMERCIAL } from './yampi-coupon.ts';

Deno.test('buildCouponCode: primeiro nome ASCII maiúsculo + percentual, ≤20 chars', () => {
  assertEquals(buildCouponCode('Gabriella Souza', 10), 'GABRIELLA10');
  // Nota: o brief tinha 'JOOPEDRO20' aqui, mas o algoritmo verbatim do brief (idêntico ao
  // agente pré-existente em index.ts:2692-2694) produz 'JOAOPEDRO20' — verificado por execução
  // direta do NFD+strip. Corrigido para o valor real, preservando o comportamento do agente.
  assertEquals(buildCouponCode('joão-pedro', 20), 'JOAOPEDRO20');
  assertEquals(buildCouponCode('', 5), 'CLIENTE5');
  assertEquals(buildCouponCode('Maximiliano Alexandre', 15).length <= 20, true);
});

Deno.test('pickCouponCode: reaproveita ativo, sufixa quando o base está usado/expirado', async () => {
  const existsNone = async (_c: string) => null;
  assertEquals(await pickCouponCode('Ana', 10, existsNone), { code: 'ANA10', reused: false });
  const ativo = async (c: string) => c === 'ANA10' ? { active: true, expired: false, value: 10 } : null;
  assertEquals(await pickCouponCode('Ana', 10, ativo), { code: 'ANA10', reused: true });
  const usado = async (c: string) => (c === 'ANA10' || c === 'ANA10X2') ? { active: false, expired: true, value: 10 } : null;
  assertEquals(await pickCouponCode('Ana', 10, usado), { code: 'ANA10X3', reused: false });
});

Deno.test('listas de percentuais', () => {
  assertEquals([...COUPON_PERCENTS_AGENT], [5, 10, 15]);
  assertEquals([...COUPON_PERCENTS_COMMERCIAL], [5, 10, 15, 20]);
});
