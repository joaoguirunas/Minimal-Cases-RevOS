import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { shouldMoveStage } from './esteira-progress.ts';

const CLAIMED = '2026-09-08T12:00:00Z';

Deno.test('lead sem dono: a esteira manda, mesmo voltando pro início', () => {
  assertEquals(shouldMoveStage({ claimedAt: null, currentOrder: 3, targetOrder: 0 }), true);
  assertEquals(shouldMoveStage({ claimedAt: null, currentOrder: 0, targetOrder: 3 }), true);
});

Deno.test('lead assumido não regride (carrinho_abandonado repetido)', () => {
  // "Em negociação" (3) não volta pra "Carrinho abandonado" (0)
  assertEquals(shouldMoveStage({ claimedAt: CLAIMED, currentOrder: 3, targetOrder: 0 }), false);
});

Deno.test('lead assumido ainda avança e fica parado no mesmo stage', () => {
  assertEquals(shouldMoveStage({ claimedAt: CLAIMED, currentOrder: 3, targetOrder: 6 }), true);
  assertEquals(shouldMoveStage({ claimedAt: CLAIMED, currentOrder: 3, targetOrder: 3 }), true);
});

Deno.test('ordem desconhecida mantém o comportamento antigo', () => {
  assertEquals(shouldMoveStage({ claimedAt: CLAIMED, currentOrder: null, targetOrder: 0 }), true);
  assertEquals(shouldMoveStage({ claimedAt: CLAIMED, currentOrder: 3, targetOrder: null }), true);
});
