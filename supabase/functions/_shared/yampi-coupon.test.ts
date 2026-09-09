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
  assertEquals(await pickCouponCode('Ana', 10, existsNone), { code: 'ANA10', reused: false, expiresAt: null });
  // Sem `owner` (nenhuma checagem de dono possível) o ativo é reaproveitado — comportamento legado.
  const ativo = async (c: string) => c === 'ANA10' ? { active: true, expired: false, value: 10 } : null;
  assertEquals(await pickCouponCode('Ana', 10, ativo), { code: 'ANA10', reused: true, expiresAt: null });
  const usado = async (c: string) => (c === 'ANA10' || c === 'ANA10X2') ? { active: false, expired: true, value: 10 } : null;
  assertEquals(await pickCouponCode('Ana', 10, usado), { code: 'ANA10X3', reused: false, expiresAt: null });
});

Deno.test('pickCouponCode: ativo da MESMA pessoa é reaproveitado com a validade real do CRM', async () => {
  const ativo = async (c: string) => c === 'ANA10' ? { active: true, expired: false, value: 10 } : null;
  const owner = async (c: string) =>
    c === 'ANA10' ? { peopleId: 'p-1', expiresAt: '2026-09-11T12:00:00.000Z' } : null;
  assertEquals(
    await pickCouponCode('Ana', 10, ativo, { peopleId: 'p-1', owner }),
    { code: 'ANA10', reused: true, expiresAt: '2026-09-11T12:00:00.000Z' },
  );
});

Deno.test('pickCouponCode: ativo de OUTRA pessoa é colisão de primeiro nome → sufixa, não reaproveita', async () => {
  const ativo = async (c: string) => c === 'ANA10' ? { active: true, expired: false, value: 10 } : null;
  const owner = async (c: string) =>
    c === 'ANA10' ? { peopleId: 'p-outra', expiresAt: '2026-09-11T12:00:00.000Z' } : null;
  assertEquals(
    await pickCouponCode('Ana', 10, ativo, { peopleId: 'p-1', owner }),
    { code: 'ANA10X2', reused: false, expiresAt: null },
  );
});

Deno.test('pickCouponCode: sufixo ativo volta pro dono; sufixo de terceiro é pulado', async () => {
  // ANA10 é de outra pessoa, ANA10X2 também, ANA10X3 é nosso e está ativo.
  const ativos = new Set(['ANA10', 'ANA10X2', 'ANA10X3']);
  const find = async (c: string) => ativos.has(c) ? { active: true, expired: false, value: 10 } : null;
  const donos: Record<string, { peopleId: string; expiresAt: string }> = {
    ANA10: { peopleId: 'p-a', expiresAt: '2026-09-10T00:00:00.000Z' },
    ANA10X2: { peopleId: 'p-b', expiresAt: '2026-09-10T00:00:00.000Z' },
    ANA10X3: { peopleId: 'p-1', expiresAt: '2026-09-12T00:00:00.000Z' },
  };
  const owner = async (c: string) => donos[c] ?? null;
  assertEquals(
    await pickCouponCode('Ana', 10, find, { peopleId: 'p-1', owner }),
    { code: 'ANA10X3', reused: true, expiresAt: '2026-09-12T00:00:00.000Z' },
  );
});

Deno.test('pickCouponCode: sufixo ativo DESCONHECIDO do CRM não é reaproveitado (nunca foi nosso)', async () => {
  const find = async (c: string) =>
    (c === 'ANA10' || c === 'ANA10X2') ? { active: true, expired: false, value: 10 } : null;
  const owner = async (c: string) => c === 'ANA10' ? { peopleId: 'p-outra', expiresAt: null } : null;
  assertEquals(
    await pickCouponCode('Ana', 10, find, { peopleId: 'p-1', owner }),
    { code: 'ANA10X3', reused: false, expiresAt: null },
  );
});

Deno.test('listas de percentuais', () => {
  assertEquals([...COUPON_PERCENTS_AGENT], [5, 10, 15]);
  assertEquals([...COUPON_PERCENTS_COMMERCIAL], [5, 10, 15, 20]);
});
