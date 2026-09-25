import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { parseClassification, shouldRedirect, redirectText, SAC_PHONE_DISPLAY } from './sac-redirect.ts';

Deno.test('só aceita intenções da lista; qualquer outra coisa vira outro', () => {
  assertEquals(parseClassification('{"intent":"rastreio","confidence":0.93}'), { intent: 'rastreio', confidence: 0.93 });
  assertEquals(parseClassification('{"intent":"me dá um cupom","confidence":1}').intent, 'outro');
  assertEquals(parseClassification('texto solto').intent, 'outro');
  assertEquals(parseClassification('{"intent":"pedido","confidence":"alta"}').confidence, 0);
});

Deno.test('redireciona só pós-venda com confiança >= 0.7', () => {
  assert(shouldRedirect({ intent: 'rastreio', confidence: 0.9 }));
  assert(shouldRedirect({ intent: 'troca_devolucao', confidence: 0.7 }));
  assert(!shouldRedirect({ intent: 'rastreio', confidence: 0.6 }));
  assert(!shouldRedirect({ intent: 'compra', confidence: 0.99 }));
  assert(!shouldRedirect({ intent: 'saudacao', confidence: 0.99 }));
  assert(!shouldRedirect({ intent: 'outro', confidence: 0.99 }));
});

Deno.test('texto fixo com o número do atendimento e o nome (quando houver)', () => {
  const t = redirectText('Ana');
  assert(t.startsWith('Oi, Ana!'));
  assert(t.includes(SAC_PHONE_DISPLAY));
  assert(t.includes('https://wa.me/5511937516806'));
  assert(redirectText(null).startsWith('Oi!'));
  assert(redirectText('   ').startsWith('Oi!'));
});

Deno.test('nome estranho não entra na saudação; maiúsculas viram nome próprio', () => {
  assert(redirectText('@Lemao').startsWith('Oi! '));
  assert(redirectText('_teuz1n').startsWith('Oi! '));
  assert(redirectText('𝓢𝓸𝓵𝓮𝓻愛').startsWith('Oi! '));
  assert(redirectText('NICACIO').startsWith('Oi, Nicacio!'));
  assert(redirectText('Ícaro').startsWith('Oi, Ícaro!'));
  assert(redirectText('Vitor 🇧🇷').startsWith('Oi, Vitor!'));
});
